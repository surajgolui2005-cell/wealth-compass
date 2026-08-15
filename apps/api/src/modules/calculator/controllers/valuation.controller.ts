import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ValuationEngine } from "../valuation.engine";
import { CalcMethod } from "../interfaces/calculator.interface";
import { PortfolioValuationSummaryDto } from "../dto/portfolio-valuation-summary.dto";
import { PositionValuationDto } from "../dto/position-valuation.dto";

@UseGuards(JwtAuthGuard)
@Controller("api/v1/portfolios")
export class ValuationController {
  constructor(private readonly valuationEngine: ValuationEngine) {}

  /**
   * GET /api/v1/portfolios/:id/valuation?method=FIFO
   *
   * Pure read-only portfolio valuation endpoint.
   * Computes real-time net worth, cost basis, unrealized P&L, realized P&L,
   * and asset allocation breakdown on-demand without writing to database snapshots.
   */
  @Get(":id/valuation")
  @HttpCode(HttpStatus.OK)
  async getPortfolioValuation(
    @Req() req: Request & { user: { id: string } },
    @Param("id") portfolioId: string,
    @Query("method") methodParam?: string,
  ): Promise<PortfolioValuationSummaryDto> {
    const method = this.parseMethod(methodParam);
    return this.valuationEngine.valuatePortfolio(req.user.id, portfolioId, method);
  }

  /**
   * GET /api/v1/portfolios/:portfolioId/holdings/:holdingId/valuation?method=FIFO
   *
   * Pure read-only holding valuation endpoint.
   * Computes holding-level position metrics, cost basis, live market valuation,
   * and STCG/LTCG realized gain records.
   */
  @Get(":portfolioId/holdings/:holdingId/valuation")
  @HttpCode(HttpStatus.OK)
  async getHoldingValuation(
    @Req() req: Request & { user: { id: string } },
    @Param("holdingId") holdingId: string,
    @Query("method") methodParam?: string,
  ): Promise<PositionValuationDto> {
    const method = this.parseMethod(methodParam);
    return this.valuationEngine.valuateHolding(req.user.id, holdingId, method);
  }

  private parseMethod(methodParam?: string): CalcMethod {
    if (!methodParam) return CalcMethod.FIFO;

    const normalized = methodParam.trim().toUpperCase();
    if (normalized === "FIFO") return CalcMethod.FIFO;
    if (normalized === "AVERAGE_COST" || normalized === "WAC" || normalized === "AVG") {
      return CalcMethod.AVERAGE_COST;
    }
    if (normalized === "LIFO") return CalcMethod.LIFO;

    throw new BadRequestException(
      `Invalid valuation method: "${methodParam}". Supported methods are FIFO, AVERAGE_COST.`,
    );
  }
}
