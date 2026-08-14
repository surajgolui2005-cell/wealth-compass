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
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CsvColumnMapping } from '../interfaces/provider.interface';
import { ProviderFactoryService } from '../services/provider-factory.service';
import { ProviderIngestionService } from '../services/provider-ingestion.service';

class ImportCsvDto {
  portfolioId: string;
  csvContent: string;
  customMapping?: CsvColumnMapping;
}

class SyncProviderDto {
  providerCode: string;
  credentials?: Record<string, any>;
}

@UseGuards(JwtAuthGuard)
@Controller('api/v1/providers')
export class ProviderController {
  constructor(
    private readonly providerIngestionService: ProviderIngestionService,
    private readonly providerFactoryService: ProviderFactoryService,
  ) {}

  @Get('supported')
  @HttpCode(HttpStatus.OK)
  getSupportedProviders() {
    return {
      providers: this.providerFactoryService.getSupportedProviders(),
    };
  }

  @Post('csv/import')
  @HttpCode(HttpStatus.OK)
  async importCsv(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: ImportCsvDto,
  ) {
    return this.providerIngestionService.ingestCsvContent(
      req.user.id,
      dto.portfolioId,
      dto.csvContent,
      dto.customMapping,
    );
  }

  @Post('sync/:portfolioId')
  @HttpCode(HttpStatus.OK)
  async syncProviderAccount(
    @Req() req: Request & { user: { id: string } },
    @Param('portfolioId') portfolioId: string,
    @Body() dto: SyncProviderDto,
  ) {
    return this.providerIngestionService.syncProviderAccount(
      req.user.id,
      portfolioId,
      dto.providerCode,
      dto.credentials || {},
    );
  }
}
