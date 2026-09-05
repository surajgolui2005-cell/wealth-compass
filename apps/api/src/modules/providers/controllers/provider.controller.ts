import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CsvColumnMapping } from "../interfaces/provider.interface";
import { ProviderFactoryService } from "../services/provider-factory.service";
import { ProviderIngestionService } from "../services/provider-ingestion.service";

class ImportCsvDto {
  portfolioId: string;
  csvContent: string;
  customMapping?: CsvColumnMapping;
}

class SyncProviderDto {
  providerCode: string;
  credentials?: Record<string, any>;
  accountId?: string;
}

class ConnectAccountDto {
  providerCode: string;
  accountName: string;
  credentials?: Record<string, any>;
}

@UseGuards(JwtAuthGuard)
@Controller("api/v1/providers")
export class ProviderController {
  constructor(
    private readonly providerIngestionService: ProviderIngestionService,
    private readonly providerFactoryService: ProviderFactoryService,
  ) {}

  @Get("supported")
  @HttpCode(HttpStatus.OK)
  getSupportedProviders() {
    return {
      providers: this.providerFactoryService.getSupportedProviders(),
    };
  }

  @Post("accounts")
  @HttpCode(HttpStatus.CREATED)
  async connectAccount(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: ConnectAccountDto,
  ) {
    return this.providerIngestionService.saveProviderAccount(req.user.id, dto as any);
  }

  @Get("accounts")
  @HttpCode(HttpStatus.OK)
  async getAccounts(@Req() req: Request & { user: { id: string } }) {
    const accounts = await this.providerIngestionService.getProviderAccounts(req.user.id);
    return { accounts };
  }

  @Delete("accounts/:id")
  @HttpCode(HttpStatus.OK)
  async disconnectAccount(@Req() req: Request & { user: { id: string } }, @Param("id") id: string) {
    return this.providerIngestionService.deleteProviderAccount(req.user.id, id);
  }

  @Post("csv/import")
  @HttpCode(HttpStatus.OK)
  async importCsv(@Req() req: Request & { user: { id: string } }, @Body() dto: ImportCsvDto) {
    return this.providerIngestionService.ingestCsvContent(
      req.user.id,
      dto.portfolioId,
      dto.csvContent,
      dto.customMapping,
    );
  }

  @Post("sync/:portfolioId")
  @HttpCode(HttpStatus.OK)
  async syncProviderAccount(
    @Req() req: Request & { user: { id: string } },
    @Param("portfolioId") portfolioId: string,
    @Body() dto: SyncProviderDto,
  ) {
    return this.providerIngestionService.syncProviderAccount(
      req.user.id,
      portfolioId,
      dto.providerCode,
      dto.credentials || {},
      dto.accountId,
    );
  }
}
