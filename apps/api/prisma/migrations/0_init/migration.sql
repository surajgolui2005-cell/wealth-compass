-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "RiskTolerance" AS ENUM ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE');

-- CreateEnum
CREATE TYPE "ProviderCode" AS ENUM ('ZERODHA', 'GROWW', 'BINANCE', 'ICICI_DIRECT', 'WAZIRX', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'SYNCING');

-- CreateEnum
CREATE TYPE "AssetClassCode" AS ENUM ('STOCKS', 'ETFS', 'MUTUAL_FUNDS', 'BONDS', 'CRYPTO', 'CASH', 'FIXED_DEPOSITS', 'REAL_ESTATE');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('EQUITY', 'FIXED_INCOME', 'CASH_EQUIVALENT', 'ALTERNATIVE');

-- CreateEnum
CREATE TYPE "CostBasisMethod" AS ENUM ('FIFO', 'LIFO', 'AVERAGE_COST');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'BONUS', 'INTEREST', 'DEPOSIT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRICE_THRESHOLD', 'DRAWDOWN_LIMIT', 'RISK_SCORE_SPIKE', 'FD_MATURITY', 'SYNC_FAILURE', 'PORTFOLIO_REBALANCE');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('PORTFOLIO_SUMMARY', 'PERFORMANCE', 'TAX_GAINS', 'RISK_ANALYSIS', 'TRANSACTION_HISTORY');

-- CreateEnum
CREATE TYPE "FileFormat" AS ENUM ('PDF', 'CSV');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "phone_encrypted" VARCHAR(255),
    "full_name" VARCHAR(255),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "home_currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "risk_tolerance" "RiskTolerance" NOT NULL DEFAULT 'MODERATE',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    "notification_settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "total_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_provider_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider_code" "ProviderCode" NOT NULL,
    "account_name" VARCHAR(128) NOT NULL,
    "vault_secret_path" VARCHAR(255),
    "status" "ProviderStatus" NOT NULL DEFAULT 'CONNECTED',
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" VARCHAR(64),
    "sync_error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "financial_provider_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_classes" (
    "id" UUID NOT NULL,
    "code" "AssetClassCode" NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "category" "AssetCategory" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "asset_class_id" UUID NOT NULL,
    "symbol" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "isin" VARCHAR(12),
    "exchange" VARCHAR(32),
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "provider_account_id" UUID,
    "symbol" VARCHAR(64) NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "avg_cost_basis" DECIMAL(18,8) NOT NULL,
    "current_price" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "current_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unrealized_pnl" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unrealized_pnl_pct" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "cost_currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "cost_basis_method" "CostBasisMethod" NOT NULL DEFAULT 'AVERAGE_COST',
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "holding_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "price_per_unit" DECIMAL(18,8) NOT NULL,
    "fees" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "fx_rate_to_home" DECIMAL(18,8) NOT NULL DEFAULT 1.0,
    "transacted_at" TIMESTAMP(3) NOT NULL,
    "provider_ref_id" VARCHAR(128),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_prices" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,
    "open_price" DECIMAL(18,8),
    "high_price" DECIMAL(18,8),
    "low_price" DECIMAL(18,8),
    "close_price" DECIMAL(18,8),
    "volume" DECIMAL(18,4),
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "price_timestamp" TIMESTAMP(3) NOT NULL,
    "source" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_snapshots" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "total_net_worth" DECIMAL(18,4) NOT NULL,
    "total_cost_basis" DECIMAL(18,4) NOT NULL,
    "unrealized_pnl" DECIMAL(18,4) NOT NULL,
    "realized_pnl" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "daily_change_abs" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "daily_change_pct" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "asset_allocation" JSONB NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_metric_snapshots" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "var_95_1d" DECIMAL(18,4) NOT NULL,
    "cvar_95_1d" DECIMAL(18,4) NOT NULL,
    "sharpe_ratio" DECIMAL(18,4) NOT NULL,
    "sortino_ratio" DECIMAL(18,4) NOT NULL,
    "beta" DECIMAL(18,4) NOT NULL,
    "max_drawdown" DECIMAL(18,4) NOT NULL,
    "volatility_annual" DECIMAL(18,4) NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "concentration_risk" JSONB,
    "correlation_matrix" JSONB,
    "price_history_days_used" INTEGER NOT NULL DEFAULT 252,
    "computed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "alert_type" "AlertType" NOT NULL,
    "condition" JSONB NOT NULL,
    "channels" JSONB NOT NULL,
    "cooldown_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_logs" (
    "id" UUID NOT NULL,
    "alert_rule_id" UUID NOT NULL,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggered_values" JSONB NOT NULL,
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "delivered_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "portfolio_id" UUID,
    "report_type" "ReportType" NOT NULL,
    "file_format" "FileFormat" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "file_url" VARCHAR(512),
    "file_size_bytes" INTEGER,
    "parameters" JSONB DEFAULT '{}',
    "error_message" TEXT,
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_status_idx" ON "users"("status");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "portfolios_user_id_deleted_at_idx" ON "portfolios"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "financial_provider_accounts_user_id_provider_code_idx" ON "financial_provider_accounts"("user_id", "provider_code");
CREATE INDEX "financial_provider_accounts_status_idx" ON "financial_provider_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "asset_classes_code_key" ON "asset_classes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "assets_isin_key" ON "assets"("isin");
CREATE UNIQUE INDEX "assets_symbol_exchange_key" ON "assets"("symbol", "exchange");
CREATE INDEX "assets_symbol_idx" ON "assets"("symbol");
CREATE INDEX "assets_isin_idx" ON "assets"("isin");
CREATE INDEX "assets_asset_class_id_idx" ON "assets"("asset_class_id");

-- CreateIndex
CREATE INDEX "holdings_portfolio_id_symbol_idx" ON "holdings"("portfolio_id", "symbol");
CREATE INDEX "holdings_portfolio_id_deleted_at_idx" ON "holdings"("portfolio_id", "deleted_at");
CREATE INDEX "holdings_asset_id_idx" ON "holdings"("asset_id");
CREATE INDEX "holdings_provider_account_id_idx" ON "holdings"("provider_account_id");

-- CreateIndex
CREATE INDEX "transactions_holding_id_transacted_at_idx" ON "transactions"("holding_id", "transacted_at");
CREATE INDEX "transactions_transacted_at_idx" ON "transactions"("transacted_at");
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "market_prices_asset_id_price_timestamp_idx" ON "market_prices"("asset_id", "price_timestamp");
CREATE INDEX "market_prices_price_timestamp_idx" ON "market_prices"("price_timestamp");

-- CreateIndex
CREATE INDEX "portfolio_snapshots_portfolio_id_snapshot_date_idx" ON "portfolio_snapshots"("portfolio_id", "snapshot_date");
CREATE INDEX "portfolio_snapshots_snapshot_date_idx" ON "portfolio_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "risk_metric_snapshots_portfolio_id_computed_at_idx" ON "risk_metric_snapshots"("portfolio_id", "computed_at");

-- CreateIndex
CREATE INDEX "alert_rules_user_id_is_active_idx" ON "alert_rules"("user_id", "is_active");
CREATE INDEX "alert_rules_alert_type_idx" ON "alert_rules"("alert_type");

-- CreateIndex
CREATE INDEX "alert_logs_alert_rule_id_triggered_at_idx" ON "alert_logs"("alert_rule_id", "triggered_at");
CREATE INDEX "alert_logs_delivery_status_idx" ON "alert_logs"("delivery_status");

-- CreateIndex
CREATE INDEX "reports_user_id_status_idx" ON "reports"("user_id", "status");
CREATE INDEX "reports_created_at_idx" ON "reports"("created_at");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_provider_accounts" ADD CONSTRAINT "financial_provider_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_asset_class_id_fkey" FOREIGN KEY ("asset_class_id") REFERENCES "asset_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "financial_provider_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_metric_snapshots" ADD CONSTRAINT "risk_metric_snapshots_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_logs" ADD CONSTRAINT "alert_logs_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
