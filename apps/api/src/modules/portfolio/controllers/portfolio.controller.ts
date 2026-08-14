import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CreatePortfolioDto } from '../dto/create-portfolio.dto';
import { UpdatePortfolioDto } from '../dto/update-portfolio.dto';
import { PortfolioService } from '../services/portfolio.service';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/portfolios')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPortfolio(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: CreatePortfolioDto,
  ) {
    return this.portfolioService.createPortfolio(req.user.id, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getUserPortfolios(@Req() req: Request & { user: { id: string } }) {
    return this.portfolioService.getUserPortfolios(req.user.id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getPortfolioById(
    @Req() req: Request & { user: { id: string } },
    @Param('id') portfolioId: string,
  ) {
    return this.portfolioService.getPortfolioById(req.user.id, portfolioId);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updatePortfolio(
    @Req() req: Request & { user: { id: string } },
    @Param('id') portfolioId: string,
    @Body() dto: UpdatePortfolioDto,
  ) {
    return this.portfolioService.updatePortfolio(req.user.id, portfolioId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deletePortfolio(
    @Req() req: Request & { user: { id: string } },
    @Param('id') portfolioId: string,
  ) {
    return this.portfolioService.deletePortfolio(req.user.id, portfolioId);
  }
}
