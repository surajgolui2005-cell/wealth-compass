# ADR-0002: Backend Framework

| Field          | Value                                            |
|----------------|--------------------------------------------------|
| **ADR ID**     | 0002                                             |
| **Title**      | Backend Framework — NestJS Modular Monolith      |
| **Status**     | Accepted                                         |
| **Date**       | 2026-08-13                                       |
| **Deciders**   | Principal Architecture Team                      |
| **Supersedes** | —                                                |
| **Superseded by** | —                                             |
| **Ref**        | SA-001 §1.2, §2, §3.3                           |

---

## Context

The IPMS backend must serve as the central orchestration layer for six distinct bounded contexts: Authentication, Data Ingestion, Portfolio & Valuation, Risk Analytics, Alert Engine, and Report Generation. The framework chosen governs:

1. **Domain isolation** — how cleanly bounded contexts are separated within a shared process
2. **TypeScript compatibility** — type safety end-to-end from database to API contract
3. **BullMQ integration** — async job queue for all I/O-bound background work
4. **OpenAPI generation** — API contract as code, not a hand-written YAML file
5. **Dependency injection** — how services, repositories, and cross-module dependencies are wired
6. **Developer ergonomics** — how quickly an engineer can add a new endpoint, guard, or interceptor

### Financial Domain Requirements

The financial domain places specific demands on the backend framework:

- **ACID transaction support**: Cost-basis computation (FIFO/LIFO/Average) must span multiple table writes atomically. The framework must cleanly expose transaction scopes.
- **Decimal precision**: Financial arithmetic must use `DECIMAL(20,8)` at the DB layer, never IEEE 754 float. Framework must not silently coerce numbers.
- **Audit trail**: Every data-modifying action (holding created, transaction added, alert triggered) must be logged with `userId`, `timestamp`, and `IP`. Cross-cutting interceptors are the architectural mechanism for this.
- **Read-only external API principle**: The framework must make it structurally easy to enforce that no module ever calls a brokerage write endpoint. This is enforced via the provider adapter abstraction.

### Scale Targets

- MVP: 5,000 concurrent users, 10 RPS sustained
- V1.0: 50,000 concurrent users, 10,000 RPS peak

### Team Profile

- 3–5 TypeScript backend engineers at MVP
- Strong familiarity with Angular-style DI patterns (NestJS, Spring) preferred over functional paradigms (Koa, Fastify bare)

---

## Decision

**We will use NestJS 10.x (Node.js 20 LTS, TypeScript 5.x) as the backend framework, structured as a modular monolith.**

Each PRD epic maps to exactly one NestJS module with a strict barrel export policy. Cross-module communication uses the in-process NestJS `EventEmitter2` event bus for domain events, not direct service injection (preventing circular dependencies and coupling drift).

---

## Options Considered

### Option A: NestJS 10 — Modular Monolith (Selected)

**Description:** Opinionated TypeScript framework with Angular-style decorators, built-in DI container, module system, Passport.js integration, TypeORM integration, BullMQ integration via `@nestjs/bull`, and OpenAPI generation via `@nestjs/swagger`.

| Criteria | Assessment |
|---|---|
| Domain isolation | ✅ NestJS module boundary enforces explicit imports — cross-context dependencies are immediately visible |
| TypeScript support | ✅ First-class — decorators, metadata reflection, full type inference |
| BullMQ integration | ✅ `@nestjs/bullmq` provides `@Processor`, `@Worker`, `@InjectQueue` decorators — idiomatic and tested |
| OpenAPI generation | ✅ `@nestjs/swagger` generates OpenAPI 3.1 spec from decorators — no hand-written YAML |
| Transaction support | ✅ TypeORM `DataSource.transaction()` or `@Transactional()` decorator cleanly wraps business logic |
| Developer ergonomics | ✅ CLI scaffolding (`nest g module`, `nest g service`) accelerates boilerplate |
| Ecosystem maturity | ✅ Used at scale by Adidas, Roche, Tripadvisor, ING Bank |
| Performance | ✅ Node.js 20 + Fastify adapter: ~35,000 req/sec on benchmark hardware (well above our 10,000 RPS target) |
| Financial precision | ✅ No framework-level number coercion; TypeORM column type `decimal` maps to JS string, preventing float drift |
| Learning curve | ✅ Low for engineers familiar with Angular DI or Spring |

### Option B: Express.js + TypeScript (custom structure)

**Description:** Minimal HTTP framework; all architectural structure (DI, modules, validation) built manually or via third-party libraries.

| Criteria | Assessment |
|---|---|
| Domain isolation | ❌ No built-in module system — requires discipline to avoid cross-context spaghetti |
| TypeScript support | ⚠️ Works, but type safety relies on manual type annotations, not framework-enforced |
| BullMQ integration | ⚠️ BullMQ works fine with Express but requires manual wiring |
| OpenAPI generation | ⚠️ Requires `swagger-jsdoc` or similar — comments, not type-safe decorators |
| Developer ergonomics | ❌ High boilerplate for auth guards, validation pipes, interceptors — must be hand-rolled |
| Scalability | ✅ Express handles scale; but the human cost of maintaining custom middleware chains grows |

**Why not selected:** In a domain with 44 user stories and 6 bounded contexts, Express without structure becomes a maintenance liability within 6 months. NestJS provides the structural constraints that keep a growing codebase coherent.

### Option C: Fastify + TypeScript (bare)

**Description:** High-performance Node.js framework; faster than Express but similarly minimal in structure.

| Criteria | Assessment |
|---|---|
| Performance | ✅ ~76,000 req/sec on benchmark hardware — fastest Node.js framework |
| Domain isolation | ❌ Same structural weakness as Express — no enforced module boundary |
| OpenAPI generation | ⚠️ `fastify-swagger` exists but is schema-driven, not decorator-driven |
| BullMQ integration | ⚠️ Manual wiring required |

**Why not selected:** Performance is not the bottleneck at our scale (10,000 RPS). NestJS can use the Fastify adapter under the hood anyway, capturing the performance benefit. The structural discipline NestJS provides is more valuable than the raw throughput delta.

### Option D: Django REST Framework (Python)

**Description:** Python-based web framework; would unify backend language with the Quant Engine.

| Criteria | Assessment |
|---|---|
| Language unification | ✅ Single language (Python) for API and quant computation |
| TypeScript ecosystem | ❌ Python cannot participate in the TypeScript workspace; shared types require separate schema generation (Pydantic → TypeScript via `datamodel-code-generator`) |
| BullMQ integration | ❌ BullMQ is Node.js-native; would require Celery instead, adding a second broker technology |
| OpenAPI generation | ✅ `drf-spectacular` generates OpenAPI spec |
| ORM | ⚠️ Django ORM is Python-native; TypeORM (used by the NestJS API) cannot be shared |
| Performance | ⚠️ Django is synchronous by default; async views require ASGI + careful migration |
| Team fit | ❌ Team is TypeScript-native; Django adds language context-switching cost |

**Why not selected:** The quant engine is specifically isolated to Python because of NumPy/Pandas. Bringing the entire API layer to Python provides no advantage and loses the TypeScript type-safety ecosystem that prevents runtime errors in a financial domain. Two language runtimes are better than one undifferentiated Python monolith that conflates I/O orchestration with matrix computation.

### Option E: tRPC + Node.js (API-less type sharing)

**Description:** End-to-end type-safe API layer where procedure definitions in the backend directly generate TypeScript types for the frontend — no REST or OpenAPI.

| Criteria | Assessment |
|---|---|
| Type safety | ✅ Maximum — backend and frontend types are literally the same TypeScript code |
| OpenAPI compatibility | ❌ tRPC is not REST — third-party integrations (mobile apps, CA tax tools, webhooks) cannot consume a tRPC endpoint natively |
| BullMQ integration | ⚠️ tRPC is transport-agnostic; BullMQ integration is not idiomatic |
| Mobile compatibility | ❌ React Native can call tRPC, but the protocol is opaque to native HTTP clients |
| External API exposure (V1.0) | ❌ PRD §7.11 specifies a public REST API for V1.0; tRPC would require an additional REST adapter layer |

**Why not selected:** The V1.0 roadmap includes a public REST API for external integrations. tRPC locks the API to a TypeScript-to-TypeScript coupling that cannot serve non-TypeScript clients. NestJS with OpenAPI provides the REST contract while still enabling type sharing via `packages/shared-types`.

---

## Consequences

### Positive

- **Structural enforcement of bounded contexts.** NestJS modules cannot import from each other unless explicitly declared in `imports[]`. This is a compile-time (lint-time) constraint, not just a convention.
- **OpenAPI spec is always current.** `@nestjs/swagger` decorators on DTOs and controllers generate the spec at startup — not a separately maintained file that drifts.
- **BullMQ integration is idiomatic.** `@Processor('queue-name')` with `@Process('job-name')` provides strongly-typed job handlers with DI support.
- **Guard/Interceptor/Pipe pipeline.** Cross-cutting concerns (JWT auth, rate limiting, audit logging, response envelope transformation) are applied globally via NestJS pipelines — not repeated per endpoint.
- **Transaction support is clean.** TypeORM's `DataSource` is injectable; `queryRunner.startTransaction()` / `commitTransaction()` / `rollbackTransaction()` wrap atomic multi-table operations with a clear, testable boundary.

### Negative / Trade-offs

- **NestJS decorator magic can obscure what is happening.** Engineers new to the framework sometimes struggle to trace what middleware/guard/pipe is active. Mitigation: strong documentation of the request lifecycle in `docs/dev/REQUEST_LIFECYCLE.md`.
- **Cold start time is ~1.5–2 seconds** (DI container bootstrap). This is irrelevant for a long-running server process but means unit tests that spin up the full `TestingModule` are slower than pure unit tests. Mitigation: use `createTestingModule` sparingly; prefer pure unit tests for domain logic, integration tests for controllers.
- **NestJS couples to TypeORM and BullMQ via `@nestjs/*` wrappers.** Switching ORM or job queue in the future requires refactoring the wrapper layer. Accepted trade-off given the strategic commitment to PostgreSQL (ADR-0004) and BullMQ (ADR-0005).

### Neutral

- NestJS v10 supports both Express and Fastify adapters. We start with the Fastify adapter for superior throughput. This is transparent to application code.
- The `workers` process (`apps/workers`) imports NestJS modules from `apps/api/src/` directly via the pnpm workspace. This enables workers to reuse domain services (e.g., `PortfolioService`, `AlertService`) without code duplication, while deploying as a separate container.

---

## Compliance Check

| Requirement | Met? | Notes |
|---|---|---|
| Financial precision: no silent number coercion | ✅ | TypeORM DECIMAL → string in JS; `decimal.js` for arithmetic |
| Developer velocity: scaffolding and DI | ✅ | `nest g` CLI + DI container |
| Scalability: 10,000 RPS at V1.0 | ✅ | Fastify adapter; horizontal scaling behind ALB |
| Bounded context isolation: enforced structurally | ✅ | NestJS module boundary |
| External API: OpenAPI 3.1 spec | ✅ | `@nestjs/swagger` generates at startup |

---

*ADR-0002 — Accepted 2026-08-13*
