# Graph Report - Investor Portolio Monitoring and Risk Management System  (2026-08-14)

## Corpus Check
- Corpus is ~42,681 words - fits in a single context window. You may not need a graph.

## Summary
- 141 nodes · 132 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Turborepo Config
- UI Components Package
- Root Package
- Web App Package
- Workers App Package
- TSConfig Rules
- API App Package
- Shared Types Package
- Quant Engine Package
- Source Code Exports
- TS Paths Config
- Config Package
- Python Package

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 10 edges
2. `scripts` - 5 edges
3. `scripts` - 5 edges
4. `scripts` - 5 edges
5. `scripts` - 5 edges
6. `scripts` - 5 edges
7. `tasks` - 5 edges
8. `outputs` - 5 edges
9. `scripts` - 4 edges
10. `scripts` - 4 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (13 total, 1 thin omitted)

### Community 0 - "Turborepo Config"
Cohesion: 0.13
Nodes (16): ^build, .next/**, out/**, dependsOn, outputs, cache, persistent, dist/** (+8 more)

### Community 1 - "UI Components Package"
Cohesion: 0.12
Nodes (15): dependencies, @investor-pm/types, @investor-pm/types, main, name, peerDependencies, react, private (+7 more)

### Community 2 - "Root Package"
Cohesion: 0.13
Nodes (14): devDependencies, turbo, engines, node, pnpm, turbo, name, packageManager (+6 more)

### Community 3 - "Web App Package"
Cohesion: 0.14
Nodes (13): dependencies, @investor-pm/types, @investor-pm/ui, @investor-pm/types, name, private, scripts, build (+5 more)

### Community 4 - "Workers App Package"
Cohesion: 0.14
Nodes (13): dependencies, @investor-pm/api, @investor-pm/types, @investor-pm/types, name, private, scripts, build (+5 more)

### Community 5 - "TSConfig Rules"
Cohesion: 0.15
Nodes (12): node_modules, compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, skipLibCheck (+4 more)

### Community 6 - "API App Package"
Cohesion: 0.17
Nodes (11): dependencies, @investor-pm/types, @investor-pm/types, name, private, scripts, build, dev (+3 more)

### Community 7 - "Shared Types Package"
Cohesion: 0.20
Nodes (9): main, name, private, scripts, build, lint, test, types (+1 more)

### Community 8 - "Quant Engine Package"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, lint, test, version

### Community 9 - "Source Code Exports"
Cohesion: 0.29
Nodes (5): Holding, RiskSnapshot, Transaction, User, UserPreferences

### Community 10 - "TS Paths Config"
Cohesion: 0.29
Nodes (7): packages/config/*, packages/shared-types/src/index.ts, packages/ui-components/src/index.ts, paths, @investor-pm/config/*, @investor-pm/types, @investor-pm/ui

### Community 11 - "Config Package"
Cohesion: 0.40
Nodes (4): main, name, private, version

## Knowledge Gaps
- **90 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+85 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `compilerOptions` connect `TSConfig Rules` to `TS Paths Config`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `paths` connect `TS Paths Config` to `TSConfig Rules`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _90 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Turborepo Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1323529411764706 - nodes in this community are weakly interconnected._
- **Should `UI Components Package` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Root Package` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Web App Package` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._