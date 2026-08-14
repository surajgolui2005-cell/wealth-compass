# Graph Report - Investor Portolio Monitoring and Risk Management System (2026-08-14)

## Corpus Check

- 35 files · ~44,659 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 546 nodes · 521 edges · 40 communities (35 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `35d38e22`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- outputs
- ui-components/package.json
- package.json
- web/package.json
- workers/package.json
- compilerOptions
- api/package.json
- shared-types/package.json
- scripts
- shared-types/src/index.ts
- System Architecture Document
- config/package.json
- quant-engine
- Product Discovery Document
- Product Requirements Document (PRD)
- Phase 2 — Product Requirements Document (COMPLETE)
- ADR-0002: Backend Framework
- 2. Epic 1 — Auth & User Preference Management
- 3. Epic 2 — Multi-Provider Data Ingestion & Transaction Recording
- 5. Epic 4 — Performance & Risk Analytics Dashboard
- ADR-0001: Monorepo Strategy
- ADR-0006: Mobile Framework
- 5. Functional Requirements
- ADR-0003: Quant Service Engine
- 4. Epic 3 — Deterministic Valuation & Holding Engine
- 6. Epic 5 — Automated Alert Engine
- ADR-0004: Database and ORM
- ADR-0005: Cache and Job Queue
- 7. Feature Scope Matrix — MVP vs V1.0 vs V2.0
- 6. Non-Functional Requirements
- config/tsconfig.json
- Wealth Compass: Investor Portfolio Monitoring & Risk Management System
- env.ts
- env.js
- dev-setup.sh
- rules/graphify.md
- workflows/graphify.md

## God Nodes (most connected - your core abstractions)

1. `System Architecture Document` - 17 edges
2. `5. Functional Requirements` - 16 edges
3. `Product Discovery Document` - 15 edges
4. `Product Requirements Document (PRD)` - 12 edges
5. `7. Feature Scope Matrix — MVP vs V1.0 vs V2.0` - 12 edges
6. `6. Non-Functional Requirements` - 11 edges
7. `compilerOptions` - 10 edges
8. `2. Epic 1 — Auth & User Preference Management` - 9 edges
9. `3. Epic 2 — Multi-Provider Data Ingestion & Transaction Recording` - 9 edges
10. `5. Epic 4 — Performance & Risk Analytics Dashboard` - 9 edges

## Surprising Connections (you probably didn't know these)

- `runTests()` --calls--> `validateEnv()` [EXTRACTED]
  packages/config/src/test-env.ts → packages/config/src/env.ts

## Import Cycles

- None detected.

## Communities (40 total, 5 thin omitted)

### Community 0 - "outputs"

Cohesion: 0.13
Nodes (16): ^build, .next/**, out/**, dependsOn, outputs, cache, persistent, dist/** (+8 more)

### Community 1 - "ui-components/package.json"

Cohesion: 0.12
Nodes (15): dependencies, @investor-pm/types, @investor-pm/types, main, name, peerDependencies, react, private (+7 more)

### Community 2 - "package.json"

Cohesion: 0.08
Nodes (25): husky, lint-staged, devDependencies, husky, lint-staged, prettier, turbo, engines (+17 more)

### Community 3 - "web/package.json"

Cohesion: 0.14
Nodes (13): dependencies, @investor-pm/types, @investor-pm/ui, @investor-pm/types, name, private, scripts, build (+5 more)

### Community 4 - "workers/package.json"

Cohesion: 0.14
Nodes (13): dependencies, @investor-pm/api, @investor-pm/types, @investor-pm/types, name, private, scripts, build (+5 more)

### Community 5 - "compilerOptions"

Cohesion: 0.10
Nodes (20): node_modules, packages/config/*, packages/config/src/index.ts, packages/shared-types/src/index.ts, packages/ui-components/src/index.ts, compilerOptions, baseUrl, esModuleInterop (+12 more)

### Community 6 - "api/package.json"

Cohesion: 0.17
Nodes (11): dependencies, @investor-pm/types, @investor-pm/types, name, private, scripts, build, dev (+3 more)

### Community 7 - "shared-types/package.json"

Cohesion: 0.20
Nodes (9): main, name, private, scripts, build, lint, test, types (+1 more)

### Community 8 - "scripts"

Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, lint, test, version

### Community 9 - "shared-types/src/index.ts"

Cohesion: 0.29
Nodes (5): Holding, RiskSnapshot, Transaction, User, UserPreferences

### Community 10 - "System Architecture Document"

Cohesion: 0.04
Nodes (44): 10. Observability Architecture, 11. Architecture Decision Records (ADR) Summary, 12. Open Questions Resolved, 1.1 Guiding Principles, 1.2 Architectural Pattern: Modular Monolith + Quant Microservice, 1. System Overview & Architectural Philosophy, 2. Technology Stack Decisions, 3.1 Level 1 — System Context Diagram (+36 more)

### Community 11 - "config/package.json"

Cohesion: 0.10
Nodes (19): dotenv, dependencies, dotenv, zod, devDependencies, @types/node, typescript, main (+11 more)

### Community 13 - "Product Discovery Document"

Cohesion: 0.05
Nodes (41): 10.1 Technical Risks, 10.2 Business Risks, 10.3 Key Assumptions, 10. Risk & Assumptions Log, 11.1 Product Metrics, 11.2 Technical Metrics, 11.3 Business Metrics, 11.4 Risk & Safety Metrics (+33 more)

### Community 14 - "Product Requirements Document (PRD)"

Cohesion: 0.10
Nodes (20): 1.1 User Story Format, 1.2 Epic Codes, 1.3 Personas Quick Reference, 1. Document Conventions, 7. Epic 6 — Report Generation (PDF/CSV), 8. Cross-Epic Edge Cases Matrix, 9. Story Dependency Graph, Acceptance Criteria (+12 more)

### Community 15 - "Phase 2 — Product Requirements Document (COMPLETE)"

Cohesion: 0.11
Nodes (18): Architecture Snapshot (Phase 1 Assumptions), Asset Class Tracking, Changelog, Deliverables Produced, Deliverables Produced, Document Registry, Financial Edge Cases Formally Specified, Key Decisions Made in Phase 1 (+10 more)

### Community 16 - "ADR-0002: Backend Framework"

Cohesion: 0.11
Nodes (17): ADR-0002: Backend Framework, Compliance Check, Consequences, Context, Decision, Financial Domain Requirements, Negative / Trade-offs, Neutral (+9 more)

### Community 17 - "2. Epic 1 — Auth & User Preference Management"

Cohesion: 0.12
Nodes (17): 2. Epic 1 — Auth & User Preference Management, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria (+9 more)

### Community 18 - "3. Epic 2 — Multi-Provider Data Ingestion & Transaction Recording"

Cohesion: 0.12
Nodes (17): 3. Epic 2 — Multi-Provider Data Ingestion & Transaction Recording, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria (+9 more)

### Community 19 - "5. Epic 4 — Performance & Risk Analytics Dashboard"

Cohesion: 0.12
Nodes (17): 5. Epic 4 — Performance & Risk Analytics Dashboard, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria (+9 more)

### Community 20 - "ADR-0001: Monorepo Strategy"

Cohesion: 0.12
Nodes (15): ADR-0001: Monorepo Strategy, Compliance Check, Consequences, Constraints, Context, Decision, Directory Layout, Negative / Trade-offs (+7 more)

### Community 21 - "ADR-0006: Mobile Framework"

Cohesion: 0.12
Nodes (15): ADR-0006: Mobile Framework, Compliance Check, Consequences, Context, Decision, Mobile Feature Requirements, Negative / Trade-offs, Neutral (+7 more)

### Community 22 - "5. Functional Requirements"

Cohesion: 0.12
Nodes (16): 5. Functional Requirements, FR-10: Multi-Currency Support `[MVP]`, FR-11: Rebalancing Advisor `[V1.0]`, FR-12: Tax Optimisation Insights `[V1.0]`, FR-13: Goal-Based Investment Tracking `[V1.0]`, FR-14: AI-Powered Portfolio Insights `[V2.0]`, FR-15: Collaborative Portfolio Sharing `[V2.0]`, FR-1: User Authentication & Account Management `[MVP]` (+8 more)

### Community 23 - "ADR-0003: Quant Service Engine"

Cohesion: 0.13
Nodes (14): ADR-0003: Quant Service Engine, Compliance Check, Consequences, Constraints, Context, Decision, Negative / Trade-offs, Neutral (+6 more)

### Community 24 - "4. Epic 3 — Deterministic Valuation & Holding Engine"

Cohesion: 0.13
Nodes (15): 4. Epic 3 — Deterministic Valuation & Holding Engine, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria (+7 more)

### Community 25 - "6. Epic 5 — Automated Alert Engine"

Cohesion: 0.13
Nodes (15): 6. Epic 5 — Automated Alert Engine, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria, Acceptance Criteria (+7 more)

### Community 26 - "ADR-0004: Database and ORM"

Cohesion: 0.14
Nodes (13): ADR-0004: Database and ORM, Compliance Check, Consequences, Context, Decision, Negative / Trade-offs, Option A: PostgreSQL 16 + TimescaleDB + TypeORM (Selected), Option B: MongoDB + Mongoose (NoSQL Alternative) (+5 more)

### Community 27 - "ADR-0005: Cache and Job Queue"

Cohesion: 0.14
Nodes (13): ADR-0005: Cache and Job Queue, Compliance Check, Consequences, Context, Decision, Negative / Trade-offs, Neutral, Option A: Redis 7 + BullMQ (Selected) (+5 more)

### Community 28 - "7. Feature Scope Matrix — MVP vs V1.0 vs V2.0"

Cohesion: 0.17
Nodes (12): 7.10 AI & Intelligence, 7.11 Platform & Infrastructure, 7.1 Authentication & User Management, 7.2 Asset Integration, 7.3 Portfolio Dashboard, 7.4 Asset Class Coverage, 7.5 Performance Analytics, 7.6 Risk Analytics (+4 more)

### Community 29 - "6. Non-Functional Requirements"

Cohesion: 0.18
Nodes (11): 6. Non-Functional Requirements, NFR-10: Mobile Responsiveness, NFR-1: Performance & Latency, NFR-2: Scalability, NFR-3: Availability & Reliability, NFR-4: Security, NFR-5: Data Privacy & Compliance, NFR-6: Observability & Monitoring (+3 more)

### Community 30 - "config/tsconfig.json"

Cohesion: 0.22
Nodes (8): compilerOptions, declaration, outDir, rootDir, extends, include, src/**/*, ../../tsconfig.json

### Community 31 - "Wealth Compass: Investor Portfolio Monitoring & Risk Management System"

Cohesion: 0.25
Nodes (7): ✨ Key Features, 📄 License, 🚀 Overview, 📦 Project Structure, 🚀 Quick Start, 🛠️ Technology Stack, Wealth Compass: Investor Portfolio Monitoring & Risk Management System

### Community 32 - "env.ts"

Cohesion: 0.38
Nodes (4): EnvConfig, envSchema, validateEnv(), runTests()

## Knowledge Gaps

- **351 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+346 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `Product Requirements Document (PRD)` connect `Product Requirements Document (PRD)` to `2. Epic 1 — Auth & User Preference Management`, `3. Epic 2 — Multi-Provider Data Ingestion & Transaction Recording`, `5. Epic 4 — Performance & Risk Analytics Dashboard`, `4. Epic 3 — Deterministic Valuation & Holding Engine`, `6. Epic 5 — Automated Alert Engine`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `Product Discovery Document` connect `Product Discovery Document` to `7. Feature Scope Matrix — MVP vs V1.0 vs V2.0`, `6. Non-Functional Requirements`, `5. Functional Requirements`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `2. Epic 1 — Auth & User Preference Management` connect `2. Epic 1 — Auth & User Preference Management` to `Product Requirements Document (PRD)`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _351 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `outputs` be split into smaller, more focused modules?**
  _Cohesion score 0.1323529411764706 - nodes in this community are weakly interconnected._
- **Should `ui-components/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
