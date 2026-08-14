# ADR-0006: Mobile Framework

| Field          | Value                                            |
|----------------|--------------------------------------------------|
| **ADR ID**     | 0006                                             |
| **Title**      | Mobile Application Framework                     |
| **Status**     | Accepted                                         |
| **Date**       | 2026-08-13                                       |
| **Deciders**   | Principal Architecture Team                      |
| **Supersedes** | —                                                |
| **Superseded by** | —                                             |
| **Ref**        | [ARCHITECTURE.md](file:///c:/Users/suraj/project/Investor%20Portolio%20Monitoring%20and%20Risk%20Management%20System/docs/architecture/ARCHITECTURE.md#L2) §2, §8.1, D-006 |

---

## Context

The IPMS product roadmap outlines a multi-platform strategy. Phase 6 introduces the MVP Web Application (built with Next.js 14), while Phase 11 expands the platform with native iOS and Android mobile applications.

### Mobile Feature Requirements

- **Complex Financial Visualisation**: Rendering interactive historical asset value charts, allocation pie charts, correlation matrices, and risk metrics (VaR, Sharpe).
- **Real-Time Push Notifications**: Delivering instant alerts for risk breaches, daily price changes, and data sync status via Firebase Cloud Messaging (FCM).
- **Secure Hardware Storage**: Storing sensitive biometric sessions (FaceID/TouchID tokens) and cache settings securely on the device.
- **Offline read capability**: Allowing users to view cached portfolio structures and risk parameters when internet connectivity is lost or spotty.
- **Biometric Authentication**: Native FaceID, TouchID, and Android Fingerprint prompts to authenticate user access quickly.

### Organizational Constraints

- **Developer Velocity**: The mobile development team is small (2–3 engineers) and must share code and types with the Next.js web application frontend and NestJS backend modules.
- **Resource Constraints**: Maintaining three completely separate frontend codebases (Next.js Web, Swift iOS, and Kotlin Android) would split developer focus and slow down feature development.
- **Contract Synchronization**: The mobile app must remain fully aligned with backend API contracts (OpenAPI models) to prevent runtime crashes caused by type changes.

We must select the mobile framework that provides native-like performance, accelerates feature delivery, and integrates with the TypeScript monorepo.

---

## Decision

**We will adopt React Native (using Expo Application Services) as our mobile application framework for iOS and Android.**

The mobile codebase will reside in `apps/mobile` within the Turborepo monorepo. It will share configuration files (ESLint, Prettier, TypeScript presets) from `packages/config` and import canonical TypeScript DTO schemas directly from `packages/shared-types`.

---

## Options Considered

### Option A: React Native + Expo (Selected)

**Description:** An open-source framework by Meta that allows writing JavaScript/TypeScript code to render native platform UI components. Expo provides a layer of pre-configured libraries, builders, and OTA (Over-The-Air) update tooling to simplify native API interactions.

| Criteria | Assessment |
|---|---|
| Code Sharing / Types | ✅ Excellent — Native TypeScript support; imports types directly from `packages/shared-types` |
| Developer Velocity | ✅ High — Frontend web engineers can contribute immediately; single language (TS) for Web, Backend, and Mobile |
| Performance | ✅ High — Compiles to native UI components; supports hardware acceleration for animations and charts |
| Native API Access | ✅ Rich — Expo ecosystem provides unified, tested APIs for biometrics, push notifications, and secure storage |
| OTA Updates | ✅ Native support — EAS Update allows pushing hotfixes and UI tweaks without waiting for App Store approval |

### Option B: Flutter (Dart)

**Description:** Google’s cross-platform UI framework. Apps are written in the Dart language, and UI components are rendered using Flutter’s custom Skia/Impeller graphics engine, bypassing native platform wrappers.

| Criteria | Assessment |
|---|---|
| UI Fidelity | ✅ High — Identical layout representation across all platforms; excellent animation performance |
| Developer Velocity | ⚠️ Moderate — Requires learning the Dart programming language and widget lifecycle concepts |
| Code Sharing / Types | ❌ Weak — Mobile cannot share code or types directly with the Next.js web app; requires compiling OpenAPI models to Dart |
| Native Integrations | ✅ High — Rich library plugins for biometrics and push notifications |

**Why not selected:** Flutter requires writing code in Dart, which isolates the mobile codebase from our TypeScript-centric monorepo. We would lose the ability to share type contracts directly (`packages/shared-types`), introducing API contract drift risk and forcing us to run custom code-generation pipelines.

### Option C: Swift (iOS) and Kotlin (Android) Dual Native

**Description:** Developing two completely separate native applications. Swift and SwiftUI are used for iOS; Kotlin and Jetpack Compose are used for Android.

| Criteria | Assessment |
|---|---|
| Application Performance | ✅ Maximum — Zero bridge overhead; direct access to native OS optimizations and layouts |
| App Size | ✅ Smallest — No cross-platform runtime bundles required |
| Developer Velocity | ❌ Lowest — Requires building, testing, and debugging every feature twice |
| Team Footprint | ❌ High — Requires hiring distinct Swift and Kotlin engineers, doubling the team's operational costs |
| Code Sharing | ❌ Zero — No logic or code sharing between iOS, Android, and Web platforms |

**Why not selected:** While native development offers the best performance, the cost of maintaining two separate mobile repositories—in addition to our web app—is too high for a startup scale. React Native provides 95% of native performance at a fraction of the operational cost.

### Option D: Progressive Web Application (PWA) Only

**Description:** Do not build native mobile apps. Optimize the Next.js 14 web application for mobile web browsers, and make it installable on iOS and Android home screens as a PWA.

| Criteria | Assessment |
|---|---|
| Deployment Cost | ✅ Zero — Single codebase deployed to a web server; no App Store review processes |
| Code Sharing | ✅ 100% — Web and mobile are the exact same application code |
| Push Notifications | ❌ Poor — Weak support on iOS Safari; notifications are unreliable compared to native push channels |
| Biometric Security | ❌ Weak — WebAuthn is complex to configure and lacks native FaceID prompt customization |
| Performance | ❌ Limited — Browser engines struggle to render large, scrollable financial lists and charts smoothly |

**Why not selected:** A financial monitoring application requires strong user retention, which depends on reliable push notifications (e.g. alert breaches) and seamless security (e.g. instant biometric login). PWAs cannot deliver the robust system integration and smooth UX that users expect from a premium financial product.

---

## Consequences

### Positive

- **Shared Type Safety**: API schemas and types are imported directly from `packages/shared-types`. If backend fields are added or renamed, compile-time checks in `apps/mobile` will flag errors immediately, preventing runtime crashes in production.
- **One Unified Team**: Frontend developers can contribute to both Next.js Web and React Native Mobile, preventing team silos and improving resource utilization.
- **Biometric Integration**: Access to device keychain features via Expo SecureStore and LocalAuthentication allows us to implement biometrics in under a day.
- **EAS Updates**: EAS (Expo Application Services) allows us to push critical bug fixes or UI updates directly to user devices in seconds, bypassing the 2-day App Store review bottlenecks.
- **Chart Reusability**: We can utilize libraries like `react-native-svg` and `victory-native` to build mobile charts that mirror the styling and structure of our web dashboard.

### Negative / Trade-offs

- **JS-to-Native Bridge Latency**: Passing massive data payloads (e.g. thousand-line raw transaction histories) across the JS-to-Native bridge can cause UI stutter. Mitigation: The backend processes and aggregates all data; the mobile client only receives computed values and page slices.
- **Upgrading Expo**: Major Expo SDK updates occur quarterly and can introduce breaking changes in third-party native libraries, requiring dedicated maintenance cycles.
- **React Native Web Limitations**: While React Native can theoretically compile to Web, we explicitly separate Web (`Next.js`) and Mobile (`React Native`). This allows Next.js to leverage Server-Side Rendering (SSR) and React Server Components (RSC) for optimal SEO, while React Native focuses purely on client-side mobile experience.

### Neutral

- Expo App builds require EAS credentials or local macOS runners for iOS builds. This setup is handled once in the CI/CD pipeline via GitHub Actions matrix configurations.

---

## Compliance Check

| Requirement | Met? | Notes |
|---|---|---|
| **Financial precision** | ✅ | Utilizes the same decimal validation utilities and shared types as the Web interface, preventing calculation drift. |
| **Developer velocity** | ✅ | Shared language (TypeScript) and shared component structure allow developers to build mobile screens in parallel with web views. |
| **System scalability** | ✅ | Offloads calculations to the backend; mobile app acts as a lean display client running on native OS threads. |

---

*ADR-0006 — Accepted 2026-08-13*
