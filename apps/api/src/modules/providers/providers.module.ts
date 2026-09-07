import { Module } from "@nestjs/common";
import { CryptoModule } from "../../common/crypto/crypto.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { PortfolioModule } from "../portfolio/portfolio.module";
import { CsvProviderAdapter } from "./adapters/csv-provider.adapter";
import { CamsCasPdfAdapter } from "./adapters/cams-cas-pdf.adapter";
import { ManualEntryAdapter } from "./adapters/manual-entry.adapter";
import { MockBrokerProviderAdapter } from "./adapters/mock-broker.adapter";
import { RbiAccountAggregatorAdapter } from "./adapters/rbi-account-aggregator.adapter";
import { ProviderController } from "./controllers/provider.controller";
import { ProviderFactoryService } from "./services/provider-factory.service";
import { ProviderIngestionService } from "./services/provider-ingestion.service";

@Module({
  imports: [AuthModule, PortfolioModule, PrismaModule, CryptoModule],
  controllers: [ProviderController],
  providers: [
    ManualEntryAdapter,
    CsvProviderAdapter,
    CamsCasPdfAdapter,
    MockBrokerProviderAdapter,
    RbiAccountAggregatorAdapter,
    ProviderFactoryService,
    ProviderIngestionService,
  ],
  exports: [
    ProviderFactoryService,
    ProviderIngestionService,
    CsvProviderAdapter,
    CamsCasPdfAdapter,
    RbiAccountAggregatorAdapter,
  ],
})
export class ProvidersModule {}
