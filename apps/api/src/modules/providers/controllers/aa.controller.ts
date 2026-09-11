import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { SetuAaService } from "../services/setu-aa.service";
import { ProviderIngestionService } from "../services/provider-ingestion.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { AssetClassCode, AssetCategory, ProviderCode } from "@prisma/client";

export class CreateAaConsentBodyDto {
  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @IsOptional()
  @IsString()
  portfolioId?: string;

  @IsOptional()
  @IsString()
  broker?: string;

  @IsOptional()
  @IsString()
  brokerName?: string;
}

export class FetchAaDataBodyDto {
  @IsString()
  @IsNotEmpty()
  portfolioId: string;

  @IsOptional()
  @IsString()
  brokerName?: string;
}

@Controller("api/v1/aa")
export class AaController {
  private readonly logger = new Logger(AaController.name);

  constructor(
    private readonly setuAaService: SetuAaService,
    private readonly providerIngestionService: ProviderIngestionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a new Setu AA consent request
   */
  @UseGuards(JwtAuthGuard)
  @Post("consent")
  @HttpCode(HttpStatus.OK)
  async createConsent(@Body() body: CreateAaConsentBodyDto) {
    const response = await this.setuAaService.createConsentRequest({
      mobileNumber: body.mobileNumber,
      portfolioId: body.portfolioId,
    });

    return {
      success: true,
      data: {
        ...response,
        brokerName: body.brokerName || body.broker || null,
      },
    };
  }

  /**
   * Get AA consent status
   */
  @UseGuards(JwtAuthGuard)
  @Get("consent/:consentId")
  async getConsentStatus(@Param("consentId") consentId: string) {
    const status = await this.setuAaService.getConsentStatus(consentId);
    return {
      success: true,
      data: status,
    };
  }

  /**
   * Fetch FI data (Holdings) for approved consent and ingest into portfolio
   */
  @UseGuards(JwtAuthGuard)
  @Post("consent/:consentId/fetch")
  @HttpCode(HttpStatus.OK)
  async fetchAndIngestData(
    @Req() req: any,
    @Param("consentId") consentId: string,
    @Body() body: FetchAaDataBodyDto,
  ) {
    const userId = req.user.id;
    const portfolioId = body.portfolioId;
    // brokerName is the human-friendly label (e.g. "Groww", "Zerodha")
    // providerCode stays RBI_AA since the technical transport is always the AA framework
    const brokerName = body.brokerName || null;
    const accountDisplayName = brokerName ? `${brokerName} (via RBI AA)` : `RBI AA Demat Sync`;

    // 1. Fetch FI holdings from Setu AA service
    const fiResult = await this.setuAaService.fetchFiData(consentId);

    // 2. Find or Create FinancialProviderAccount for RBI AA
    // Key by brokerName+RBI_AA so each broker gets its own platform card
    const findKey = brokerName || "RBI_AA_DEFAULT";
    let providerAccount = await this.prisma.financialProviderAccount.findFirst({
      where: {
        userId,
        providerCode: ProviderCode.RBI_AA,
        accountName: { contains: findKey === "RBI_AA_DEFAULT" ? "RBI AA" : brokerName! },
        deletedAt: null,
      },
    });

    if (!providerAccount) {
      providerAccount = await this.prisma.financialProviderAccount.create({
        data: {
          user: { connect: { id: userId } },
          providerCode: ProviderCode.RBI_AA,
          accountName: accountDisplayName,
          status: "CONNECTED",
          lastSyncAt: new Date(),
          lastSyncStatus: "SUCCESS",
        },
      });
    } else {
      await this.prisma.financialProviderAccount.update({
        where: { id: providerAccount.id },
        data: {
          accountName: accountDisplayName,
          status: "CONNECTED",
          lastSyncAt: new Date(),
          lastSyncStatus: "SUCCESS",
        },
      });
    }

    // 3. Process & Ingest Holdings into Portfolio
    const importedHoldings = [];
    for (const h of fiResult.holdings) {
      const assetClassCode =
        h.assetType === "MUTUAL_FUND" ? AssetClassCode.MUTUAL_FUNDS : AssetClassCode.STOCKS;

      // Find or create asset class
      let assetClass = await this.prisma.assetClass.findUnique({
        where: { code: assetClassCode },
      });

      if (!assetClass) {
        assetClass = await this.prisma.assetClass.create({
          data: {
            code: assetClassCode,
            name: assetClassCode === AssetClassCode.MUTUAL_FUNDS ? "Mutual Funds" : "Equities",
            category: AssetCategory.EQUITY,
          },
        });
      }

      // Find or create Asset by ISIN or Symbol
      let asset = await this.prisma.asset.findFirst({
        where: {
          OR: [{ isin: h.isin }, { symbol: h.isin }],
        },
      });

      if (!asset) {
        asset = await this.prisma.asset.create({
          data: {
            assetClassId: assetClass.id,
            symbol: h.isin,
            name: h.companyName,
            isin: h.isin,
            currency: "INR",
            isActive: true,
          },
        });
      }

      const qty = h.quantity;
      const avgCost = h.costPrice;
      const currentPx = h.currentValue / (h.quantity || 1);
      const currVal = h.currentValue;
      const pnl = currVal - qty * avgCost;
      const pnlPct = qty * avgCost > 0 ? (pnl / (qty * avgCost)) * 100 : 0;

      // Find existing holding or create
      const existingHolding = await this.prisma.holding.findFirst({
        where: {
          portfolioId,
          assetId: asset.id,
          providerAccountId: providerAccount.id,
          deletedAt: null,
        },
      });

      let holding;
      if (existingHolding) {
        holding = await this.prisma.holding.update({
          where: { id: existingHolding.id },
          data: {
            quantity: qty,
            avgCostBasis: avgCost,
            currentPrice: currentPx,
            currentValue: currVal,
            unrealizedPnL: pnl,
            unrealizedPnLPct: pnlPct,
            updatedAt: new Date(),
          },
        });
      } else {
        holding = await this.prisma.holding.create({
          data: {
            portfolioId,
            assetId: asset.id,
            providerAccountId: providerAccount.id,
            symbol: h.isin,
            quantity: qty,
            avgCostBasis: avgCost,
            currentPrice: currentPx,
            currentValue: currVal,
            unrealizedPnL: pnl,
            unrealizedPnLPct: pnlPct,
            costCurrency: "INR",
            isManual: false,
          },
        });
      }

      importedHoldings.push(holding);
    }

    // 4. Update Portfolio Total Value
    const allHoldings = await this.prisma.holding.findMany({
      where: { portfolioId, deletedAt: null },
    });
    const totalVal = allHoldings.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);

    await this.prisma.portfolio.update({
      where: { id: portfolioId },
      data: { totalValue: totalVal },
    });

    return {
      success: true,
      message: `Successfully synced ${fiResult.holdings.length} demat holdings across Groww, AngelOne & Zerodha via RBI Account Aggregator!`,
      data: {
        importedHoldingsCount: fiResult.holdings.length,
        holdings: fiResult.holdings,
      },
    };
  }

  /**
   * Setu Webhook Endpoint for Async Consent Status Updates
   */
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async handleSetuWebhook(@Body() payload: any) {
    this.logger.log(`Received Setu AA Webhook payload: ${JSON.stringify(payload)}`);
    return { status: "RECEIVED" };
  }
}
