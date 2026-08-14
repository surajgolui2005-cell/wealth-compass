# ADR-0004: Database and ORM

| Field          | Value                                            |
|----------------|--------------------------------------------------|
| **ADR ID**     | 0004                                             |
| **Title**      | Database and ORM Selection                        |
| **Status**     | Accepted                                         |
| **Date**       | 2026-08-13                                       |
| **Deciders**   | Principal Architecture Team                      |
| **Supersedes** | —                                                |
| **Superseded by** | —                                             |
| **Ref**        | [ARCHITECTURE.md](file:///c:/Users/suraj/project/Investor%20Portolio%20Monitoring%20and%20Risk%20Management%20System/docs/architecture/ARCHITECTURE.md#L2) §2, §5.4, §11, §12 |

---

## Context

The IPMS system manages two distinct styles of application data:

1. **Relational / Transactional Data**: Users, settings, multi-provider credentials, account connections, assets (portfolios, holdings), alerts, notifications, reports, and historic cash transactions.
2. **Time-Series / Market Price Data**: Historical and real-time prices for stocks, exchange-traded funds (ETFs), mutual funds, cryptocurrencies, and foreign exchange (FX) rates.

### Technical and Domain Requirements

- **Financial Precision**: The system must store fractional share and token quantities (e.g., up to 8 decimal places for cryptocurrencies like Bitcoin satoshis or Ethereum fractions) and calculate valuations/cost-bases precisely. Rounding errors or floating-point drift (e.g., standard IEEE 754 float binary representations) are unacceptable.
- **Relational Integrity**: Assets, transactions, and holdings are heavily linked. A trade transaction must always map to an active holding; a holding must belong to a portfolio, which in turn maps to a user. Cascades, constraints, and foreign key relationships are essential to prevent orphan records or data corruption.
- **ACID Transaction Boundaries**: Real-time balance synchronizations and cost-basis changes (e.g., executing a stock split, applying dividend reinvestments, recalculating FIFO/LIFO queues) often require writing to multiple tables simultaneously. These must succeed or fail as a atomic unit.
- **High-Performance Time-Series Queries**: The Quant Engine must regularly retrieve rolling 252-day daily price historical records for all assets in a portfolio to compute Value at Risk (VaR), Sharpe ratios, and Beta. This requires sub-second price index scans over millions of records.
- **ORM Developer Velocity**: The backend team needs an Object-Relational Mapper (ORM) that integrates natively with NestJS, handles database schema migrations, and provides type-safety for queries.

We must select the database engine(s) and ORM to meet these criteria.

---

## Decision

**We will adopt PostgreSQL 16 with the TimescaleDB extension as our single hybrid database engine, and use TypeORM 0.3.x in the NestJS API layer.**

Relational models will reside in traditional PostgreSQL tables with strict foreign keys and constraints. Time-series data (live price logs, historical currency rates, NAV listings) will reside in TimescaleDB "hypertables" (partitioned automatically by time in 7-day intervals). 

TypeORM will map TypeScript classes to database tables. For decimal arithmetic, all numeric fields (e.g. asset quantities, prices, values) will be mapped to PostgreSQL `numeric(20,8)` columns, which TypeORM retrieves as JavaScript string types, to be processed in-memory using the `decimal.js` library.

---

## Options Considered

### Option A: PostgreSQL 16 + TimescaleDB + TypeORM (Selected)

**Description:** PostgreSQL 16 serves as the core ACID engine. The TimescaleDB extension runs inside the same database process, allowing time-series data partitions (hypertables) to be queried alongside relational data using standard SQL joins, via a single database connection pool. TypeORM provides TypeScript decorators and handles relational mapping and schema migrations.

| Criteria | Assessment |
|---|---|
| ACID Transactions | ✅ Exceptional — Full PostgreSQL isolation levels (Read Committed, Serializable) |
| Financial Precision | ✅ Excellent — Native `NUMERIC`/`DECIMAL(20,8)` storage; TypeORM exposes strings, avoiding float coercion |
| Time-Series Performance | ✅ High — Hypertables partition data by time; continuous aggregates pre-calculate EOD values; index sizes fit in RAM |
| Code sharing / DI | ✅ Native — TypeORM integrates with NestJS via `@nestjs/typeorm` modules and decorators |
| Operational Footprint | ✅ Low — One database process to deploy, back up, and monitor |

### Option B: MongoDB + Mongoose (NoSQL Alternative)

**Description:** A document-oriented database. Holdings, portfolios, and transactions are stored as hierarchical JSON documents in collections. Historical price history is stored in a separate collection.

| Criteria | Assessment |
|---|---|
| Schema Flexibility | ✅ High — Easy to store arbitrary metadata for different asset classes |
| ACID Transactions | ⚠️ Limited — Support exists but is slower, lacks structural relational integrity checks (no foreign key constraints) |
| Financial Precision | ❌ Poor — JavaScript/NoSQL double-precision floats are vulnerable to IEEE 754 rounding errors unless strings or custom `Decimal128` types are strictly enforced at all validation levels |
| Operational footprint | ⚠️ Moderate — Mongo scales easily but requires maintaining a separate database engine with different backup models |

**Why not selected:** Financial monitoring requires absolute transactional integrity. Lacking foreign keys means a bug in the application code can easily orphan transactions or leave holdings out of sync. PostgreSQL's rigid constraints are a feature, not a bug, in this domain.

### Option C: PostgreSQL + Prisma ORM

**Description:** Use PostgreSQL 16 (with TimescaleDB) but swap TypeORM for Prisma. Prisma uses a custom `.prisma` schema file to generate a rust-based type-safe query client.

| Criteria | Assessment |
|---|---|
| Developer Velocity | ✅ High — Auto-generated clients, clean syntax, easy database tooling |
| Type Safety | ✅ Strongest — Prisma generates static TypeScript types directly matching the database state |
| TimescaleDB Support | ❌ Weak — Prisma does not support advanced TimescaleDB operations (e.g., continuous aggregates, data compression, hypertable definitions) natively in its schema language |
| Performance | ⚠️ Prisma's Rust query engine runner adds minor startup overhead and memory cost per container |

**Why not selected:** Prisma’s schema syntax cannot model TimescaleDB-specific structures like continuous aggregates or hypertables without bypass raw SQL commands. Furthermore, Prisma has historically struggled with custom database extensions. TypeORM allows us to write standard database annotations and execute raw queries via connection runners easily.

### Option D: PostgreSQL + Raw SQL / Knex.js (SQL Builder)

**Description:** Avoid using a full ORM. Write raw SQL queries directly or use Knex.js as a query builder to compose SQL statements programmatically.

| Criteria | Assessment |
|---|---|
| Query Performance | ✅ Maximum — No ORM overhead; developers have direct control over indexes and query execution plans |
| Developer Velocity | ❌ Lower — Writing raw inserts, updates, and type mappings manually introduces significant boilerplate |
| TypeScript Integration | ⚠️ Manual — Developers must write and maintain interface types matching SQL rows, creating high drift risk |

**Why not selected:** While raw SQL offers maximum performance, it slows down developer iteration for standard CRUD operations (e.g. Auth, user settings, alert configuration). TypeORM offers the best compromise: CRUD tasks use clean decorator patterns, while complex financial reports fall back to TypeORM's `queryRunner` to run raw SQL.

---

## Consequences

### Positive

- **Relational Integrity**: Foreign keys (`user_id`, `holding_id`, `provider_connection_id`) and database-level cascades prevent data corruption. A transaction delete automatically adjusts holding cost-bases via triggers or service hooks.
- **Single Connection Pool**: Running TimescaleDB as an in-process extension means we do not need to operate and maintain two separate databases (e.g., Postgres for users, InfluxDB for prices). This saves cost and reduces operational overhead.
- **Time-Series Compression**: TimescaleDB automatically compresses chunks older than 90 days (using columnar compression), reducing storage requirements for high-frequency pricing ticks by up to 90%.
- **Continuous Aggregates**: TimescaleDB pre-computes hourly/daily OHLCV (Open-High-Low-Close-Volume) price charts. When users request charts, the API retrieves data from these pre-computed views in milliseconds, bypassing the raw tick tables.
- **Precision Lock**: Relational columns configured as `decimal(20,8)` prevent rounding drift. TypeORM pulls numbers as JavaScript strings, forcing developers to use libraries like `decimal.js` or `bignumber.js` to compute valuations.

### Negative / Trade-offs

- **TimescaleDB Upgrade Path**: Upgrading PostgreSQL major versions requires extra care to ensure TimescaleDB extension compatibility.
- **TypeORM Migrations**: Automated TypeORM schema sync can be dangerous in production. Mitigation: Schema sync is disabled in production (`synchronize: false`); all database changes must be applied via reviewed, version-controlled SQL migration scripts (`npm run migration:generate`).
- **Write Scalability**: A single relational primary database can become a write bottleneck at scale. Mitigation: The backend is read-heavy. The Next.js API uses PostgreSQL Read Replicas for dashboards, and the Quant Engine reads price history from replicas, isolating the primary DB for transaction writes.

---

## Compliance Check

| Requirement | Met? | Notes |
|---|---|---|
| **Financial precision** | ✅ | Guaranteed at rest via PostgreSQL `NUMERIC` types, and in transit via TypeORM string mapping + in-memory `decimal.js` validation. |
| **Developer velocity** | ✅ | TypeORM annotations eliminate basic SQL boilerplates, while auto-migrations keep local development environments aligned. |
| **System scalability** | ✅ | TimescaleDB partitions historical price tables into manageable 7-day chunks, keeping lookup index sizes small enough to fit in RAM. |

---

*ADR-0004 — Accepted 2026-08-13*
