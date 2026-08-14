# ADR-0001: Monorepo Strategy

| Field          | Value                                            |
|----------------|--------------------------------------------------|
| **ADR ID**     | 0001                                             |
| **Title**      | Monorepo Strategy                                |
| **Status**     | Accepted                                         |
| **Date**       | 2026-08-13                                       |
| **Deciders**   | Principal Architecture Team                      |
| **Supersedes** | —                                                |
| **Superseded by** | —                                             |
| **Ref**        | SA-001 §8.1                                      |

---

## Context

The IPMS platform comprises four distinct deployable units that must evolve in concert:

- **`apps/api`** — NestJS modular monolith (TypeScript)
- **`apps/workers`** — BullMQ background worker process (TypeScript, shares NestJS modules)
- **`apps/quant-engine`** — Python FastAPI microservice (separate language runtime)
- **`apps/web`** — Next.js 14 frontend (TypeScript/React)

These units share a substantial surface area of types (API request/response DTOs, domain entity interfaces), configuration (ESLint rules, TypeScript compiler options, Jest setup), and UI primitives (component library). The team will be small at MVP (< 10 engineers) and will scale to 20–30 at V1.0.

The key architectural tension is: **how do we organise the codebase to maximise code sharing, enable consistent tooling, and prevent cross-unit coupling drift — without introducing operational complexity that slows down a small team?**

### Constraints

- TypeScript must be the dominant language for all Node.js units; the Python quant engine lives in the same repository but with its own `requirements.txt` and isolated virtual environment.
- The team requires a single `git history`, `CI/CD` pipeline, and `npm`/`yarn` dependency graph for all TypeScript workspaces.
- Shared domain types (e.g., `HoldingDto`, `RiskSnapshotDto`) must have a single source of truth to prevent API contract drift between the NestJS API and the Next.js frontend.
- The monorepo toolchain must support incremental builds — rebuilding only the packages that changed — to keep CI under 5 minutes.

---

## Decision

**We will adopt a Turborepo-managed monorepo with pnpm workspaces.**

The repository root contains a `turbo.json` pipeline definition and a `pnpm-workspace.yaml` that registers all `apps/*` and `packages/*` workspaces. The Python quant engine is housed under `apps/quant-engine` but is excluded from the pnpm workspace graph; its builds and tests are invoked as a separate Turborepo task via a shell script entry point.

### Directory Layout

```
/
├── apps/
│   ├── api/              (NestJS — pnpm workspace)
│   ├── workers/          (NestJS BullMQ — pnpm workspace)
│   ├── web/              (Next.js 14 — pnpm workspace)
│   └── quant-engine/     (Python FastAPI — NOT in pnpm workspace)
├── packages/
│   ├── shared-types/     (canonical DTOs and domain interfaces)
│   ├── ui-components/    (React component library)
│   └── config/           (eslint-config, tsconfig-base, jest-preset)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json          (root — devDependencies only)
```

---

## Options Considered

### Option A: Turborepo + pnpm workspaces (Selected)

**Description:** Single Git repository; Turborepo orchestrates task pipelines (`build`, `test`, `lint`) across all workspaces. pnpm handles node_modules hoisting with strict isolation. Remote caching via Turborepo Cloud speeds up CI.

| Criteria | Assessment |
|---|---|
| Code sharing | ✅ `packages/shared-types` is a first-class workspace dependency — type changes propagate immediately |
| Incremental build | ✅ Turborepo hashes inputs; unchanged packages are cache-hit in < 1s |
| CI speed | ✅ Remote cache: warm CI run targets < 3 min; cold run < 8 min |
| Onboarding | ✅ `pnpm install` at root installs all workspaces |
| Python integration | ⚠️ Python quant engine is managed separately (pip + venv); Turborepo shell task wraps it |
| Operational overhead | ✅ Low — one repository, one CI pipeline definition, one set of branch protection rules |

### Option B: Nx Monorepo

**Description:** Nx provides a richer plugin ecosystem (NestJS generator, Next.js generator, Jest integration) and more granular affected-graph analysis than Turborepo.

| Criteria | Assessment |
|---|---|
| Code sharing | ✅ Excellent — first-class library concept |
| Incremental build | ✅ Affected graph is more precise than Turborepo |
| CI speed | ✅ Comparable to Turborepo with remote cache |
| Onboarding | ⚠️ Higher learning curve; Nx-specific concepts (executors, generators) not familiar to all engineers |
| Configuration overhead | ❌ `project.json` per package adds boilerplate; Nx Cloud pricing at scale |
| Python integration | ⚠️ No native Python plugin; same shell task workaround as Turborepo |

**Why not selected:** Turborepo's simpler mental model (tasks are just npm scripts + a `turbo.json` pipeline) aligns better with a small team. Nx advantages materialise at 50+ packages; at 7–10 packages, Nx adds overhead without proportional benefit.

### Option C: Polyrepo (Separate Git Repositories per Service)

**Description:** Each deployable unit (`api`, `workers`, `web`, `quant-engine`) lives in its own GitHub repository. Shared types published to a private npm registry.

| Criteria | Assessment |
|---|---|
| Code sharing | ❌ Shared types require explicit versioning, publishing, and consuming — minimum 3-step process to propagate a DTO change |
| Incremental build | ✅ Each repo builds only itself — but no cross-repo orchestration |
| CI speed | ✅ Per-repo CI is fast; but cross-repo integration tests are complex |
| Onboarding | ❌ Developer must clone 4 repos, configure 4 sets of env vars |
| Type drift risk | ❌ High — `api` may publish `v1.2.0` of shared-types while `web` still pins `v1.0.0` |
| Team coordination | ❌ Cross-cutting changes (e.g., add `riskScore` field) require 4 PRs across 4 repos |

**Why not selected:** At MVP scale, polyrepo overhead (private registry management, cross-repo PRs, type version drift) actively harms developer velocity without providing meaningful isolation benefits. Isolation will be enforced at the TypeScript module boundary and Kubernetes namespace level instead.

### Option D: Lerna + npm workspaces

**Description:** Traditional JavaScript monorepo tool, pre-dates Turborepo. Uses npm workspaces with Lerna for versioning and publishing.

| Criteria | Assessment |
|---|---|
| Incremental build | ⚠️ Lerna changed detection is less sophisticated than Turborepo |
| Maintenance | ❌ Lerna had a period of abandonment (2020–2022); community has migrated to Turborepo/Nx |
| Remote caching | ❌ No native remote cache — requires third-party setup |

**Why not selected:** Turborepo is the modern successor for this use case; Lerna provides no advantage here.

---

## Consequences

### Positive

- **Single source of truth for types.** Changes to `packages/shared-types` are immediately reflected in all dependent workspaces without a publish step. API contract drift between the NestJS API and the Next.js web app is structurally impossible.
- **Consistent tooling.** One ESLint config, one Prettier config, one TypeScript base config. `pnpm lint` at root lints all workspaces.
- **Atomic commits.** A feature touching `api`, `workers`, and `web` can be committed and reviewed as a single PR with a single set of tests — no multi-repo coordination.
- **CI efficiency.** Turborepo remote cache means PRs that only change `apps/web` skip `apps/api` rebuild/test entirely. Target: < 5 min CI for scoped changes.
- **Simplified onboarding.** `git clone && pnpm install && docker-compose up` gives a new engineer a fully running local stack.

### Negative / Trade-offs

- **Python quant engine is a first-class citizen but a second-class workspace citizen.** It cannot participate in pnpm dependency hoisting. It requires its own `Makefile`/`justfile` for `venv` creation, dependency installation, and test execution. Turborepo wraps it as a shell task. This is an accepted trade-off given the language boundary.
- **Repository size will grow.** A single `git clone` includes all application code. Mitigation: `git sparse-checkout` for engineers who only work on one workspace.
- **`node_modules` complexity.** pnpm's content-addressable store minimises disk usage but can surface subtle hoisting issues for packages with non-standard peer dependency declarations. Mitigation: `pnpm` strict mode enabled (`shamefully-hoist=false`).

### Neutral

- Branch protection and code ownership (`CODEOWNERS`) must be configured at the directory level to ensure the `apps/quant-engine` directory requires Python engineer approval.
- The shared-types package must not import from any `apps/*` package — enforced via ESLint `import/no-internal-modules` rule.

---

## Compliance Check

| Requirement | Met? | Notes |
|---|---|---|
| Financial precision: no type drift between API and UI | ✅ | Shared-types workspace enforces single contract |
| Developer velocity: single clone, single install | ✅ | `pnpm install` at root |
| Scalability: CI scales with incremental builds | ✅ | Turborepo remote cache |
| Module isolation: bounded contexts cannot import across boundaries | ✅ | ESLint boundary rules per workspace |

---

*ADR-0001 — Accepted 2026-08-13*
