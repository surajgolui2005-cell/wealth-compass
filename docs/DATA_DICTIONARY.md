# Data Dictionary — Wealth Compass Platform

**Document ID:** DD-001  
**Version:** 1.0.0  
**Status:** Approved for Production  
**Database Engine:** PostgreSQL 16 (TimescaleDB)  
**ORM / Schema Definition:** Prisma ORM 5.x (`apps/api/prisma/schema.prisma`)  
**Last Updated:** 2026-09-06

---

## 1. Overview & Financial Precision Standards

Wealth Compass enforces strict financial arithmetic precision across all storage and calculation boundaries to eliminate floating-point drift and rounding errors.

### 1.1 Precision Tiers

| Precision Tier                        | SQL Type         | Domain Usage                                                            | Example Fields                                                                      |
| :------------------------------------ | :--------------- | :---------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| **High Precision (8 decimals)**       | `DECIMAL(18, 8)` | Fractional asset quantities, crypto fractions, price per unit, FX rates | `holdings.quantity`, `transactions.price_per_unit`, `transactions.fx_rate_to_home`  |
| **Monetary Currency (4 decimals)**    | `DECIMAL(18, 4)` | Total monetary amounts, portfolio net worth, fees, P&L in base currency | `portfolios.total_value`, `holdings.current_value`, `transactions.total_amount`     |
| **Percentages & Ratios (4 decimals)** | `DECIMAL(18, 4)` | Performance returns, risk ratios, drawdown percentages                  | `holdings.unrealized_pnl_pct`, `risk_metric_snapshots.sharpe_ratio`, `max_drawdown` |
| **Integer Scores & Timers**           | `INTEGER`        | Risk composite scores (0–100), cooldown minutes, history days           | `risk_metric_snapshots.risk_score`, `alert_rules.cooldown_duration_minutes`         |

### 1.2 System Audit Conventions

Every domain entity implements standardized temporal audit columns:

- `created_at` (`TIMESTAMP WITH TIME ZONE`, default `NOW()`): Creation timestamp.
- `updated_at` (`TIMESTAMP WITH TIME ZONE`, updated via trigger / Prisma `@updatedAt`): Last modification timestamp.
- `deleted_at` (`TIMESTAMP WITH TIME ZONE`, nullable): Soft-delete tombstone. Active records query `WHERE deleted_at IS NULL`.

---

## 2. Entity Model Catalog

The platform database comprises **14 core relational models** partitioned into 5 architectural domains:

1. **Identity & Configuration:** `users`, `user_preferences`
2. **Portfolio & Asset Management:** `portfolios`, `holdings`, `transactions`
3. **Market Data & External Ingestion:** `financial_provider_accounts`, `asset_classes`, `assets`, `market_prices`
4. **Valuation & Analytics Snapshots:** `portfolio_snapshots`, `risk_metric_snapshots`
5. **Alerts & Reporting:** `alert_rules`, `alert_logs`, `reports`

---

## 3. Detailed Table Specifications

### 3.1 `users`

Represents registered platform investors and administrators.

| Column            | Type           | Nullable | Default              | Constraints | Description                                                             |
| :---------------- | :------------- | :------: | :------------------- | :---------- | :---------------------------------------------------------------------- |
| `id`              | `UUID`         |    No    | `uuid_generate_v4()` | PK          | Unique investor identity identifier.                                    |
| `email`           | `VARCHAR(255)` |    No    | —                    | UNIQUE      | Primary authentication email address (case-insensitive indexed).        |
| `password_hash`   | `VARCHAR(255)` |    No    | —                    | —           | Argon2id cryptographically hashed password.                             |
| `phone_encrypted` | `VARCHAR(255)` |   Yes    | `NULL`               | —           | AES-256-GCM encrypted contact phone number.                             |
| `full_name`       | `VARCHAR(255)` |   Yes    | `NULL`               | —           | Investor display name.                                                  |
| `status`          | `UserStatus`   |    No    | `ACTIVE`             | —           | Account lifecycle state (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `DELETED`). |
| `created_at`      | `TIMESTAMPTZ`  |    No    | `NOW()`              | —           | Account creation timestamp.                                             |
| `updated_at`      | `TIMESTAMPTZ`  |    No    | `NOW()`              | —           | Account update timestamp.                                               |
| `deleted_at`      | `TIMESTAMPTZ`  |   Yes    | `NULL`               | —           | Soft-delete timestamp.                                                  |

- **Indexes:**
  - `users_email_key` (UNIQUE `[email]`)
  - `users_status_idx` (`[status]`)
  - `users_deleted_at_idx` (`[deleted_at]`)

---

### 3.2 `user_preferences`

User-level configuration for home currency, risk profiling, and notifications.

| Column                  | Type            | Nullable | Default              | Constraints | Description                                                        |
| :---------------------- | :-------------- | :------: | :------------------- | :---------- | :----------------------------------------------------------------- |
| `id`                    | `UUID`          |    No    | `uuid_generate_v4()` | PK          | Unique preferences identifier.                                     |
| `user_id`               | `UUID`          |    No    | —                    | FK, UNIQUE  | Reference to `users(id)` (ON DELETE CASCADE).                      |
| `home_currency`         | `CHAR(3)`       |    No    | `'INR'`              | —           | ISO 4217 reporting currency code.                                  |
| `risk_tolerance`        | `RiskTolerance` |    No    | `MODERATE`           | —           | Risk tolerance profile (`CONSERVATIVE`, `MODERATE`, `AGGRESSIVE`). |
| `timezone`              | `VARCHAR(64)`   |    No    | `'Asia/Kolkata'`     | —           | IANA timezone identifier for daily rollups.                        |
| `notification_settings` | `JSONB`         |    No    | `'{}'`               | —           | Channel opt-ins (`in_app`, `email`, `webhook`).                    |
| `created_at`            | `TIMESTAMPTZ`   |    No    | `NOW()`              | —           | Creation timestamp.                                                |
| `updated_at`            | `TIMESTAMPTZ`   |    No    | `NOW()`              | —           | Modification timestamp.                                            |
| `deleted_at`            | `TIMESTAMPTZ`   |   Yes    | `NULL`               | —           | Soft-delete timestamp.                                             |

---

### 3.3 `portfolios`

Logical container grouping an investor's holdings and transactions.

| Column        | Type             | Nullable | Default              | Constraints | Description                                                    |
| :------------ | :--------------- | :------: | :------------------- | :---------- | :------------------------------------------------------------- |
| `id`          | `UUID`           |    No    | `uuid_generate_v4()` | PK          | Unique portfolio identifier.                                   |
| `user_id`     | `UUID`           |    No    | —                    | FK          | Reference to `users(id)` (ON DELETE CASCADE).                  |
| `name`        | `VARCHAR(128)`   |    No    | —                    | —           | Portfolio name (e.g., "Retirement Corpus", "Direct Equities"). |
| `description` | `TEXT`           |   Yes    | `NULL`               | —           | Optional notes on investment strategy.                         |
| `is_default`  | `BOOLEAN`        |    No    | `false`              | —           | Designates the investor's primary aggregated portfolio.        |
| `total_value` | `DECIMAL(18, 4)` |    No    | `0.0000`             | —           | Current total market valuation in base currency.               |
| `currency`    | `CHAR(3)`        |    No    | `'INR'`              | —           | Portfolio base currency.                                       |
| `created_at`  | `TIMESTAMPTZ`    |    No    | `NOW()`              | —           | Record creation timestamp.                                     |
| `updated_at`  | `TIMESTAMPTZ`    |    No    | `NOW()`              | —           | Record update timestamp.                                       |
| `deleted_at`  | `TIMESTAMPTZ`    |   Yes    | `NULL`               | —           | Soft-delete tombstone.                                         |

- **Indexes:**
  - `portfolios_user_id_deleted_at_idx` (`[user_id, deleted_at]`)

---

### 3.4 `financial_provider_accounts`

External financial brokerage, mutual fund depository, or exchange credentials.

| Column                  | Type             | Nullable | Default              | Constraints | Description                                                                               |
| :---------------------- | :--------------- | :------: | :------------------- | :---------- | :---------------------------------------------------------------------------------------- |
| `id`                    | `UUID`           |    No    | `uuid_generate_v4()` | PK          | Unique provider account identifier.                                                       |
| `user_id`               | `UUID`           |    No    | —                    | FK          | Reference to `users(id)` (ON DELETE CASCADE).                                             |
| `provider_code`         | `ProviderCode`   |    No    | —                    | —           | Provider type (`ZERODHA`, `GROWW`, `BINANCE`, `ICICI_DIRECT`, `WAZIRX`, `MANUAL`, `CSV`). |
| `account_name`          | `VARCHAR(128)`   |    No    | —                    | —           | Friendly account label (e.g., "Zerodha Equity").                                          |
| `vault_secret_path`     | `VARCHAR(255)`   |   Yes    | `NULL`               | —           | Vault path reference for external secret managers.                                        |
| `encrypted_credentials` | `TEXT`           |   Yes    | `NULL`               | —           | AES-256-GCM encrypted payload containing API keys/tokens.                                 |
| `status`                | `ProviderStatus` |    No    | `CONNECTED`          | —           | Synchronization state (`CONNECTED`, `DISCONNECTED`, `ERROR`, `SYNCING`).                  |
| `last_sync_at`          | `TIMESTAMPTZ`    |   Yes    | `NULL`               | —           | Timestamp of last successful ingestion cycle.                                             |
| `last_sync_status`      | `VARCHAR(64)`    |   Yes    | `NULL`               | —           | Status summary string of the last sync run.                                               |
| `sync_error_message`    | `TEXT`           |   Yes    | `NULL`               | —           | Detailed error message if sync failed.                                                    |
| `created_at`            | `TIMESTAMPTZ`    |    No    | `NOW()`              | —           | Record creation timestamp.                                                                |
| `updated_at`            | `TIMESTAMPTZ`    |    No    | `NOW()`              | —           | Record update timestamp.                                                                  |
| `deleted_at`            | `TIMESTAMPTZ`    |   Yes    | `NULL`               | —           | Soft-delete timestamp.                                                                    |

- **Indexes:**
  - `financial_provider_accounts_user_id_provider_code_idx` (`[user_id, provider_code]`)
  - `financial_provider_accounts_status_idx` (`[status]`)

---

### 3.5 `asset_classes`

Taxonomy reference for the 8 core financial asset classes supported by the platform.

| Column        | Type             | Nullable | Default              | Constraints | Description                                                                                                      |
| :------------ | :--------------- | :------: | :------------------- | :---------- | :--------------------------------------------------------------------------------------------------------------- |
| `id`          | `UUID`           |    No    | `uuid_generate_v4()` | PK          | Unique asset class identifier.                                                                                   |
| `code`        | `AssetClassCode` |    No    | —                    | UNIQUE      | Asset class code (`STOCKS`, `ETFS`, `MUTUAL_FUNDS`, `BONDS`, `CRYPTO`, `CASH`, `FIXED_DEPOSITS`, `REAL_ESTATE`). |
| `name`        | `VARCHAR(64)`    |    No    | —                    | —           | Human-readable name.                                                                                             |
| `description` | `TEXT`           |   Yes    | `NULL`               | —           | Asset class regulatory and investment description.                                                               |
| `category`    | `AssetCategory`  |    No    | —                    | —           | Broad grouping (`EQUITY`, `FIXED_INCOME`, `CASH_EQUIVALENT`, `ALTERNATIVE`).                                     |
| `created_at`  | `TIMESTAMPTZ`    |    No    | `NOW()`              | —           | Creation timestamp.                                                                                              |
| `updated_at`  | `TIMESTAMPTZ`    |    No    | `NOW()`              | —           | Modification timestamp.                                                                                          |

---

### 3.6 `assets`

Master financial instruments catalog (equities, funds, crypto pairs, bonds).

| Column           | Type           | Nullable | Default              | Constraints | Description                                                 |
| :--------------- | :------------- | :------: | :------------------- | :---------- | :---------------------------------------------------------- |
| `id`             | `UUID`         |    No    | `uuid_generate_v4()` | PK          | Unique instrument identifier.                               |
| `asset_class_id` | `UUID`         |    No    | —                    | FK          | Reference to `asset_classes(id)` (ON DELETE RESTRICT).      |
| `symbol`         | `VARCHAR(64)`  |    No    | —                    | —           | Trading ticker symbol (e.g., `RELIANCE`, `TCS`, `BTC-INR`). |
| `name`           | `VARCHAR(255)` |    No    | —                    | —           | Formal entity/instrument name.                              |
| `isin`           | `VARCHAR(12)`  |   Yes    | `NULL`               | UNIQUE      | International Securities Identification Number.             |
| `exchange`       | `VARCHAR(32)`  |   Yes    | `NULL`               | —           | Exchange code (`NSE`, `BSE`, `BINANCE`, `MCX`).             |
| `currency`       | `CHAR(3)`      |    No    | `'INR'`              | —           | Quoted currency.                                            |
| `is_active`      | `BOOLEAN`      |    No    | `true`               | —           | Indicates whether the security is tradeable.                |
| `metadata`       | `JSONB`        |   Yes    | `'{}'`               | —           | Extra parameters (NAV, maturity date, interest rate).       |
| `created_at`     | `TIMESTAMPTZ`  |    No    | `NOW()`              | —           | Creation timestamp.                                         |
| `updated_at`     | `TIMESTAMPTZ`  |    No    | `NOW()`              | —           | Update timestamp.                                           |
| `deleted_at`     | `TIMESTAMPTZ`  |   Yes    | `NULL`               | —           | Soft-delete timestamp.                                      |

- **Indexes:**
  - `assets_symbol_exchange_key` (UNIQUE `[symbol, exchange]`)
  - `assets_isin_key` (UNIQUE `[isin]`)
  - `assets_symbol_idx` (`[symbol]`)
  - `assets_asset_class_id_idx` (`[asset_class_id]`)

---

### 3.7 `holdings`

Aggregate positions held within a portfolio.

| Column                | Type              | Nullable | Default              | Constraints | Description                                                           |
| :-------------------- | :---------------- | :------: | :------------------- | :---------- | :-------------------------------------------------------------------- |
| `id`                  | `UUID`            |    No    | `uuid_generate_v4()` | PK          | Unique position identifier.                                           |
| `portfolio_id`        | `UUID`            |    No    | —                    | FK          | Reference to `portfolios(id)` (ON DELETE CASCADE).                    |
| `asset_id`            | `UUID`            |    No    | —                    | FK          | Reference to `assets(id)` (ON DELETE RESTRICT).                       |
| `provider_account_id` | `UUID`            |   Yes    | `NULL`               | FK          | Reference to `financial_provider_accounts(id)` (ON DELETE SET NULL).  |
| `symbol`              | `VARCHAR(64)`     |    No    | —                    | —           | Holding symbol snapshot.                                              |
| `quantity`            | `DECIMAL(18, 8)`  |    No    | —                    | —           | Current net position quantity held.                                   |
| `avg_cost_basis`      | `DECIMAL(18, 8)`  |    No    | —                    | —           | Per-unit average acquisition cost basis.                              |
| `current_price`       | `DECIMAL(18, 8)`  |    No    | `0.00000000`         | —           | Latest ingested market price per unit.                                |
| `current_value`       | `DECIMAL(18, 4)`  |    No    | `0.0000`             | —           | Current market value (`quantity * current_price`).                    |
| `unrealized_pnl`      | `DECIMAL(18, 4)`  |    No    | `0.0000`             | —           | Absolute unrealized gain/loss in base currency.                       |
| `unrealized_pnl_pct`  | `DECIMAL(18, 4)`  |    No    | `0.0000`             | —           | Percentage unrealized return (`(current_value - cost) / cost * 100`). |
| `cost_currency`       | `CHAR(3)`         |    No    | `'INR'`              | —           | Cost currency.                                                        |
| `cost_basis_method`   | `CostBasisMethod` |    No    | `AVERAGE_COST`       | —           | Lot tracking method (`FIFO`, `LIFO`, `AVERAGE_COST`).                 |
| `is_manual`           | `BOOLEAN`         |    No    | `false`              | —           | True if manually added by user.                                       |
| `created_at`          | `TIMESTAMPTZ`     |    No    | `NOW()`              | —           | Creation timestamp.                                                   |
| `updated_at`          | `TIMESTAMPTZ`     |    No    | `NOW()`              | —           | Update timestamp.                                                     |
| `deleted_at`          | `TIMESTAMPTZ`     |   Yes    | `NULL`               | —           | Soft-delete tombstone.                                                |

- **Indexes:**
  - `holdings_portfolio_id_symbol_idx` (`[portfolio_id, symbol]`)
  - `holdings_portfolio_id_deleted_at_idx` (`[portfolio_id, deleted_at]`)
  - `holdings_asset_id_idx` (`[asset_id]`)
  - `holdings_provider_account_id_idx` (`[provider_account_id]`)

---

### 3.8 `transactions`

Append-only immutable transaction ledger recording buy, sell, and corporate actions.

| Column            | Type              | Nullable | Default              | Constraints | Description                                                                                                        |
| :---------------- | :---------------- | :------: | :------------------- | :---------- | :----------------------------------------------------------------------------------------------------------------- |
| `id`              | `UUID`            |    No    | `uuid_generate_v4()` | PK          | Unique transaction identifier.                                                                                     |
| `holding_id`      | `UUID`            |    No    | —                    | FK          | Reference to `holdings(id)` (ON DELETE CASCADE).                                                                   |
| `type`            | `TransactionType` |    No    | —                    | —           | Transaction action type (`BUY`, `SELL`, `DIVIDEND`, `SPLIT`, `BONUS`, `INTEREST`, `DEPOSIT`, `WITHDRAWAL`, `FEE`). |
| `quantity`        | `DECIMAL(18, 8)`  |    No    | —                    | —           | Transacted unit quantity.                                                                                          |
| `price_per_unit`  | `DECIMAL(18, 8)`  |    No    | —                    | —           | Execution price per unit.                                                                                          |
| `fees`            | `DECIMAL(18, 4)`  |    No    | `0.0000`             | —           | Brokerage, STT, exchange, and GST fees.                                                                            |
| `total_amount`    | `DECIMAL(18, 4)`  |    No    | —                    | —           | Net settlement amount (`quantity * price + fees`).                                                                 |
| `currency`        | `CHAR(3)`         |    No    | `'INR'`              | —           | Transaction settlement currency.                                                                                   |
| `fx_rate_to_home` | `DECIMAL(18, 8)`  |    No    | `1.00000000`         | —           | Foreign exchange conversion rate to home currency.                                                                 |
| `transacted_at`   | `TIMESTAMPTZ`     |    No    | —                    | —           | Actual market execution timestamp.                                                                                 |
| `provider_ref_id` | `VARCHAR(128)`    |   Yes    | `NULL`               | —           | External broker transaction / order identifier.                                                                    |
| `notes`           | `TEXT`            |   Yes    | `NULL`               | —           | Investor custom notes.                                                                                             |
| `created_at`      | `TIMESTAMPTZ`     |    No    | `NOW()`              | —           | Database record insertion timestamp.                                                                               |
| `updated_at`      | `TIMESTAMPTZ`     |    No    | `NOW()`              | —           | Modification timestamp.                                                                                            |
| `deleted_at`      | `TIMESTAMPTZ`     |   Yes    | `NULL`               | —           | Soft-delete tombstone.                                                                                             |

- **Indexes:**
  - `transactions_holding_id_transacted_at_idx` (`[holding_id, transacted_at]`)
  - `transactions_holding_id_deleted_at_transacted_at_idx` (`[holding_id, deleted_at, transacted_at]`) _(Tuned composite B-tree index for FIFO/Weighted cost valuation)_
  - `transactions_transacted_at_idx` (`[transacted_at]`)
  - `transactions_type_idx` (`[type]`)

---

### 3.9 `market_prices`

Time-series market price ticks for financial instruments.

| Column            | Type             | Nullable | Default              | Constraints | Description                                                             |
| :---------------- | :--------------- | :------: | :------------------- | :---------- | :---------------------------------------------------------------------- |
| `id`              | `UUID`           |    No    | `uuid_generate_v4()` | PK          | Unique price tick identifier.                                           |
| `asset_id`        | `UUID`           |    No    | —                    | FK          | Reference to `assets(id)` (ON DELETE CASCADE).                          |
| `price`           | `DECIMAL(18, 8)` |    No    | —                    | —           | Current / closing unit market price.                                    |
| `open_price`      | `DECIMAL(18, 8)` |   Yes    | `NULL`               | —           | Daily opening price.                                                    |
| `high_price`      | `DECIMAL(18, 8)` |   Yes    | `NULL`               | —           | Daily intraday high price.                                              |
| `low_price`       | `DECIMAL(18, 8)` |   Yes    | `NULL`               | —           | Daily intraday low price.                                               |
| `close_price`     | `DECIMAL(18, 8)` |   Yes    | `NULL`               | —           | Daily closing price.                                                    |
| `volume`          | `DECIMAL(18, 4)` |   Yes    | `NULL`               | —           | Traded volume.                                                          |
| `currency`        | `CHAR(3)`        |    No    | `'INR'`              | —           | Price currency.                                                         |
| `price_timestamp` | `TIMESTAMPTZ`    |    No    | —                    | —           | Timestamp of quote / market tick.                                       |
| `source`          | `VARCHAR(64)`    |    No    | —                    | —           | Price source provider (`ALPHA_VANTAGE`, `COINGECKO`, `AMFI`, `MANUAL`). |
| `created_at`      | `TIMESTAMPTZ`    |    No    | `NOW()`              | —           | Ingestion timestamp.                                                    |

- **Indexes:**
  - `market_prices_asset_id_price_timestamp_idx` (`[asset_id, price_timestamp]`)
  - `market_prices_price_timestamp_idx` (`[price_timestamp]`)

---

### 3.10 `portfolio_snapshots`

Daily EOD aggregated valuation rollups for historical performance curves.

| Column             | Type             | Nullable | Default              | Constraints | Description                                                                |
| :----------------- | :--------------- | :------: | :------------------- | :---------- | :------------------------------------------------------------------------- |
| `id`               | `UUID`           |    No    | `uuid_generate_v4()` | PK          | Unique snapshot identifier.                                                |
| `portfolio_id`     | `UUID`           |    No    | —                    | FK          | Reference to `portfolios(id)` (ON DELETE CASCADE).                         |
| `total_net_worth`  | `DECIMAL(18, 4)` |    No    | —                    | —           | Portfolio net worth on snapshot date.                                      |
| `total_cost_basis` | `DECIMAL(18, 4)` |    No    | —                    | —           | Total invested cost basis.                                                 |
| `unrealized_pnl`   | `DECIMAL(18, 4)` |    No    | —                    | —           | Aggregate unrealized P&L.                                                  |
| `realized_pnl`     | `DECIMAL(18, 4)` |    No    | `0.0000`             | —           | Cumulative realized P&L to date.                                           |
| `daily_change_abs` | `DECIMAL(18, 4)` |    No    | `0.0000`             | —           | Absolute 1-day net worth delta.                                            |
| `daily_change_pct` | `DECIMAL(18, 4)` |    No    | `0.0000`             | —           | Percentage 1-day net worth return.                                         |
| `asset_allocation` | `JSONB`          |    No    | —                    | —           | Breakdown by asset class code: `{ "STOCKS": 60.5, "MUTUAL_FUNDS": 39.5 }`. |
| `snapshot_date`    | `TIMESTAMPTZ`    |    No    | —                    | —           | Snapshot calendar date (EOD).                                              |
| `created_at`       | `TIMESTAMPTZ`    |    No    | `NOW()`              | —           | Computation timestamp.                                                     |

- **Indexes:**
  - `portfolio_snapshots_portfolio_id_snapshot_date_idx` (`[portfolio_id, snapshot_date]`)
  - `portfolio_snapshots_snapshot_date_idx` (`[snapshot_date]`)

---

### 3.11 `risk_metric_snapshots`

Institutional quantitative risk engine computation results.

| Column                    | Type             | Nullable | Default              | Constraints | Description                                                                  |
| :------------------------ | :--------------- | :------: | :------------------- | :---------- | :--------------------------------------------------------------------------- |
| `id`                      | `UUID`           |    No    | `uuid_generate_v4()` | PK          | Unique risk metric record identifier.                                        |
| `portfolio_id`            | `UUID`           |    No    | —                    | FK          | Reference to `portfolios(id)` (ON DELETE CASCADE).                           |
| `var_95_1d`               | `DECIMAL(18, 4)` |    No    | —                    | —           | 1-day 95% Historical Value at Risk in base currency.                         |
| `cvar_95_1d`              | `DECIMAL(18, 4)` |    No    | —                    | —           | 1-day 95% Conditional VaR (Expected Shortfall).                              |
| `sharpe_ratio`            | `DECIMAL(18, 4)` |    No    | —                    | —           | Annualized Sharpe ratio vs risk-free benchmark.                              |
| `sortino_ratio`           | `DECIMAL(18, 4)` |    No    | —                    | —           | Sortino ratio penalizing downside volatility only.                           |
| `beta`                    | `DECIMAL(18, 4)` |    No    | —                    | —           | CAPM Beta coefficient against market index (NIFTY 50).                       |
| `max_drawdown`            | `DECIMAL(18, 4)` |    No    | —                    | —           | Maximum peak-to-trough percentage decline.                                   |
| `volatility_annual`       | `DECIMAL(18, 4)` |    No    | —                    | —           | Annualized standard deviation of daily returns ($\sigma \times \sqrt{252}$). |
| `risk_score`              | `INTEGER`        |    No    | —                    | —           | Composite risk score ranging from 0 (ultra-safe) to 100 (maximum risk).      |
| `concentration_risk`      | `JSONB`          |   Yes    | `NULL`               | —           | HHI score and top-3 / top-5 weight ratios.                                   |
| `correlation_matrix`      | `JSONB`          |   Yes    | `NULL`               | —           | Pairwise correlation matrix between active positions.                        |
| `price_history_days_used` | `INTEGER`        |    No    | `252`                | —           | Sample window of daily returns used for statistical analysis.                |
| `computed_at`             | `TIMESTAMPTZ`    |    No    | —                    | —           | Computation execution timestamp.                                             |
| `created_at`              | `TIMESTAMPTZ`    |    No    | `NOW()`              | —           | Insertion timestamp.                                                         |

- **Indexes:**
  - `risk_metric_snapshots_portfolio_id_computed_at_idx` (`[portfolio_id, computed_at]`)

---

### 3.12 `alert_rules`

Investor-configured proactive alerting conditions and notification channels.

| Column                      | Type           | Nullable | Default              | Constraints | Description                                                                                                           |
| :-------------------------- | :------------- | :------: | :------------------- | :---------- | :-------------------------------------------------------------------------------------------------------------------- |
| `id`                        | `UUID`         |    No    | `uuid_generate_v4()` | PK          | Unique rule identifier.                                                                                               |
| `user_id`                   | `UUID`         |    No    | —                    | FK          | Reference to `users(id)` (ON DELETE CASCADE).                                                                         |
| `name`                      | `VARCHAR(128)` |    No    | —                    | —           | Alert rule name (e.g., "10% Drawdown Warning").                                                                       |
| `alert_type`                | `AlertType`    |    No    | —                    | —           | Type (`PRICE_THRESHOLD`, `DRAWDOWN_LIMIT`, `RISK_SCORE_SPIKE`, `FD_MATURITY`, `SYNC_FAILURE`, `PORTFOLIO_REBALANCE`). |
| `condition`                 | `JSONB`        |    No    | —                    | —           | Evaluator parameters (e.g., `{ "thresholdPct": 10.0 }`).                                                              |
| `channels`                  | `JSONB`        |    No    | —                    | —           | Array of delivery channels: `["IN_APP", "EMAIL", "WEBHOOK"]`.                                                         |
| `cooldown_duration_minutes` | `INTEGER`      |    No    | `60`                 | —           | Minimum duration between duplicate notifications.                                                                     |
| `is_active`                 | `BOOLEAN`      |    No    | `true`               | —           | Rule active flag.                                                                                                     |
| `last_triggered_at`         | `TIMESTAMPTZ`  |   Yes    | `NULL`               | —           | Timestamp of most recent alert triggering event.                                                                      |
| `created_at`                | `TIMESTAMPTZ`  |    No    | `NOW()`              | —           | Creation timestamp.                                                                                                   |
| `updated_at`                | `TIMESTAMPTZ`  |    No    | `NOW()`              | —           | Modification timestamp.                                                                                               |
| `deleted_at`                | `TIMESTAMPTZ`  |   Yes    | `NULL`               | —           | Soft-delete tombstone.                                                                                                |

- **Indexes:**
  - `alert_rules_user_id_is_active_idx` (`[user_id, is_active]`)
  - `alert_rules_alert_type_idx` (`[alert_type]`)

---

### 3.13 `alert_logs`

Historical audit log of triggered alerts and delivery attempts.

| Column             | Type             | Nullable | Default              | Constraints | Description                                                                    |
| :----------------- | :--------------- | :------: | :------------------- | :---------- | :----------------------------------------------------------------------------- |
| `id`               | `UUID`           |    No    | `uuid_generate_v4()` | PK          | Unique alert log entry identifier.                                             |
| `alert_rule_id`    | `UUID`           |    No    | —                    | FK          | Reference to `alert_rules(id)` (ON DELETE CASCADE).                            |
| `triggered_at`     | `TIMESTAMPTZ`    |    No    | `NOW()`              | —           | Breach trigger timestamp.                                                      |
| `triggered_values` | `JSONB`          |    No    | —                    | —           | Actual values captured at the moment of breach: `{ "currentDrawdown": 12.4 }`. |
| `delivery_status`  | `DeliveryStatus` |    No    | `PENDING`            | —           | Delivery state (`PENDING`, `DELIVERED`, `FAILED`).                             |
| `delivered_at`     | `TIMESTAMPTZ`    |   Yes    | `NULL`               | —           | Confirmation timestamp when notification reached user.                         |
| `error_message`    | `TEXT`           |   Yes    | `NULL`               | —           | Error diagnostic message if delivery failed.                                   |
| `created_at`       | `TIMESTAMPTZ`    |    No    | `NOW()`              | —           | Insertion timestamp.                                                           |

- **Indexes:**
  - `alert_logs_alert_rule_id_triggered_at_idx` (`[alert_rule_id, triggered_at]`)
  - `alert_logs_delivery_status_idx` (`[delivery_status]`)

---

### 3.14 `reports`

Generated financial reports and exports (PDF, CSV).

| Column            | Type           | Nullable | Default              | Constraints | Description                                                                                                |
| :---------------- | :------------- | :------: | :------------------- | :---------- | :--------------------------------------------------------------------------------------------------------- |
| `id`              | `UUID`         |    No    | `uuid_generate_v4()` | PK          | Unique report identifier.                                                                                  |
| `user_id`         | `UUID`         |    No    | —                    | FK          | Reference to `users(id)` (ON DELETE CASCADE).                                                              |
| `portfolio_id`    | `UUID`         |   Yes    | `NULL`               | FK          | Optional reference to `portfolios(id)` (ON DELETE SET NULL).                                               |
| `report_type`     | `ReportType`   |    No    | —                    | —           | Report category (`PORTFOLIO_SUMMARY`, `PERFORMANCE`, `TAX_GAINS`, `RISK_ANALYSIS`, `TRANSACTION_HISTORY`). |
| `file_format`     | `FileFormat`   |    No    | —                    | —           | Export format (`PDF`, `CSV`).                                                                              |
| `status`          | `ReportStatus` |    No    | `PENDING`            | —           | Generation status (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`).                                        |
| `file_url`        | `VARCHAR(512)` |   Yes    | `NULL`               | —           | Storage URI or base64 data URI of generated artifact.                                                      |
| `file_size_bytes` | `INTEGER`      |   Yes    | `NULL`               | —           | File size in bytes.                                                                                        |
| `parameters`      | `JSONB`        |   Yes    | `'{}'`               | —           | Date ranges or export options supplied by user.                                                            |
| `error_message`   | `TEXT`         |   Yes    | `NULL`               | —           | Error diagnostic details if generation failed (truncated to 1,000 chars).                                  |
| `generated_at`    | `TIMESTAMPTZ`  |   Yes    | `NULL`               | —           | Timestamp when artifact generation finished.                                                               |
| `created_at`      | `TIMESTAMPTZ`  |    No    | `NOW()`              | —           | Request creation timestamp.                                                                                |
| `updated_at`      | `TIMESTAMPTZ`  |    No    | `NOW()`              | —           | Modification timestamp.                                                                                    |

- **Indexes:**
  - `reports_user_id_status_idx` (`[user_id, status]`)
  - `reports_created_at_idx` (`[created_at]`)

---

## 4. Enumeration Reference Guide

| Enum Name             | Allowed Values                                                                                                | Description                                                     |
| :-------------------- | :------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------- |
| **`UserStatus`**      | `ACTIVE`, `INACTIVE`, `SUSPENDED`, `DELETED`                                                                  | Account state and access control.                               |
| **`RiskTolerance`**   | `CONSERVATIVE`, `MODERATE`, `AGGRESSIVE`                                                                      | Risk profiling classification for allocation recommendations.   |
| **`ProviderCode`**    | `ZERODHA`, `GROWW`, `BINANCE`, `ICICI_DIRECT`, `WAZIRX`, `MANUAL`, `CSV`                                      | Ingestion provider adapters.                                    |
| **`ProviderStatus`**  | `CONNECTED`, `DISCONNECTED`, `ERROR`, `SYNCING`                                                               | External broker synchronization state.                          |
| **`AssetClassCode`**  | `STOCKS`, `ETFS`, `MUTUAL_FUNDS`, `BONDS`, `CRYPTO`, `CASH`, `FIXED_DEPOSITS`, `REAL_ESTATE`                  | The 8 core asset classes supported in Wealth Compass.           |
| **`AssetCategory`**   | `EQUITY`, `FIXED_INCOME`, `CASH_EQUIVALENT`, `ALTERNATIVE`                                                    | High-level macro asset categorization.                          |
| **`CostBasisMethod`** | `FIFO`, `LIFO`, `AVERAGE_COST`                                                                                | Accounting lot assignment methodology for tax calculations.     |
| **`TransactionType`** | `BUY`, `SELL`, `DIVIDEND`, `SPLIT`, `BONUS`, `INTEREST`, `DEPOSIT`, `WITHDRAWAL`, `FEE`                       | Supported transaction types in the financial accounting ledger. |
| **`AlertType`**       | `PRICE_THRESHOLD`, `DRAWDOWN_LIMIT`, `RISK_SCORE_SPIKE`, `FD_MATURITY`, `SYNC_FAILURE`, `PORTFOLIO_REBALANCE` | Rule evaluator conditions.                                      |
| **`DeliveryStatus`**  | `PENDING`, `DELIVERED`, `FAILED`                                                                              | Asynchronous notification transmission state.                   |
| **`ReportType`**      | `PORTFOLIO_SUMMARY`, `PERFORMANCE`, `TAX_GAINS`, `RISK_ANALYSIS`, `TRANSACTION_HISTORY`                       | Supported document export templates.                            |
| **`FileFormat`**      | `PDF`, `CSV`                                                                                                  | Generated document binary / text format.                        |
| **`ReportStatus`**    | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`                                                                | BullMQ worker report generation lifecycle state.                |

---

## 5. Domain Event Schema Catalog

Events emitted via NestJS `EventEmitter2` across internal domain bounded contexts:

### 5.1 `transaction.recorded`

Emitted immediately after a transaction is committed to PostgreSQL in `TransactionService`.

- **Payload:**
  ```typescript
  interface TransactionRecordedEvent {
    portfolioId: string;
    holdingId: string;
    transactionId: string;
    type: TransactionType;
    quantity: string;
    pricePerUnit: string;
    totalAmount: string;
    transactedAt: Date;
  }
  ```
- **Subscribers:**
  - `AnalyticsCacheManager`: Invalidates portfolio valuation and analytics cache keys.
  - `ValuationService`: Recomputes holding cost basis and portfolio market value.

### 5.2 `holding.updated`

Emitted when holding quantity or average cost basis shifts.

- **Payload:**
  ```typescript
  interface HoldingUpdatedEvent {
    portfolioId: string;
    holdingId: string;
    assetId: string;
    symbol: string;
    quantity: string;
    avgCostBasis: string;
  }
  ```
- **Subscribers:**
  - `AnalyticsCacheManager`: Purges cached analytics keys.
  - `AlertEvaluatorService`: Checks concentration and rebalance thresholds.

### 5.3 `portfolio.updated`

Emitted when portfolio metadata or total valuation changes.

- **Payload:**
  ```typescript
  interface PortfolioUpdatedEvent {
    portfolioId: string;
    userId: string;
    totalValue: string;
  }
  ```
- **Subscribers:**
  - `AnalyticsCacheManager`: Invalidates portfolio keys in Redis.
  - `AlertEvaluatorService`: Evaluates portfolio drawdown limit rules.
