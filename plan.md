# DocForge Quality Plan

## 1. Purpose and Scope
This plan defines the quality posture for the DocForge Electron application across the main process, React/TypeScript renderer, build scripts, and database/file-system layers. The objective is to raise code correctness, runtime resilience, and release reliability while enabling follow-on hardening initiatives.

## 2. Quality Objectives
- Enforce maximal TypeScript safety (`strict`, `noImplicitOverride`, `exactOptionalPropertyTypes`) across all packages.
- Drive ESLint + Prettier conformance to zero warnings, with an interim staged remediation schedule.
- Guarantee every IPC channel uses strongly typed zod schemas with aligned request/response contracts between main and renderer.
- Establish centralized error handling and structured logging, eliminating unhandled promise rejections.
- Keep long-running and blocking IO off the Electron main thread and progressively refactor synchronous pathways to async patterns.
- Maintain deterministic CI: type-check, lint, run automated tests (unit + smoke), and execute cross-platform packaging smoke checks.

## 3. Current Baseline (Initial Assessment)
- TypeScript config currently enables incremental compilation but not full strictness; renderer code mixes implicit any usage.
- ESLint configuration is absent; formatting relies on ad-hoc prettier invocations with inconsistent rules.
- IPC usage is informal (ad-hoc channel strings, loosely typed payloads) without schema validation or shared typings.
- Error logging uses `electron-log` directly in scattered modules; unhandled promise rejection policy is undefined.
- Blocking operations (SQLite access, file IO, asset generation) occur synchronously in the main process scripts.
- CI executes build scripts but lacks mandatory lint/typecheck/test gates; packaging runs manually per target.

## 4. TypeScript Hardening Strategy
1. Update `tsconfig.json` and any sub-configs:
   - Enable `strict`, `noImplicitOverride`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and `noFallthroughCasesInSwitch`.
   - Audit `include`/`exclude` to ensure both Electron main and renderer code participate in type checking.
2. Run `tsc --noEmit` to surface violations; track findings in a remediation spreadsheet with owners per module (main, renderer, scripts).
3. Prioritize fixes to unblock strict mode:
   - Replace implicit `any/unknown` with explicit types or generics.
   - Introduce shared interfaces in `types.ts` or dedicated `types/` modules.
   - Annotate Electron preload bridges and context isolations.
4. Add `tsc --noEmit` to CI (pre-commit hook optional) and enforce as merge gate once violations hit zero.

## 5. Linting & Formatting Program
1. Introduce workspace-level ESLint configuration (`eslint.config.mjs`) extending `@typescript-eslint` strict presets and `eslint-plugin-react`.
2. Configure Prettier with `.prettierrc` and add `eslint-plugin-prettier` to catch format drift; set `maxWarnings: 0` in package scripts.
3. Author scripts:
   - `lint`: `eslint . --max-warnings=0`.
   - `lint:fix`: `eslint . --fix`.
   - `format`: `prettier "**/*.{ts,tsx,js,jsx,json,md}" --write`.
4. Remediation rollout:
   - Phase 1: Autofix-safe rules (spacing, quotes, imports) via `lint:fix` and Prettier.
   - Phase 2: Targeted rule bundles (`no-floating-promises`, `@typescript-eslint/consistent-type-imports`, `react-hooks/exhaustive-deps`). Owners file tickets per bundle and close within sprint.
   - Phase 3: Enable opinionated but high-signal rules (`@typescript-eslint/restrict-template-expressions`, `sonarjs/no-duplicated-branches`) after addressing hotspots.
5. Integrate ESLint into CI; gate merges on zero warnings.

## 6. IPC Contract Governance
1. Inventory existing IPC channels (`electron/main`, `preload`, renderer hooks/services). Document purpose, payload shape, and response semantics in `docs/ipc-contracts.md`.
2. Establish shared contract modules:
   - Create `electron/ipc/contracts/` with `zod` schemas for every request/response pair.
   - Export TypeScript types via `z.infer` and share through the preload bridge to renderer modules.
3. Refactor IPC wiring:
   - Main process: wrap `ipcMain.handle` with a validator that parses incoming data, logs validation errors, and returns typed responses.
   - Renderer: create typed helpers (e.g., `invokeChannel<TReq, TRes>(schema, channel)`) to enforce compile-time alignment.
4. Add unit tests (Vitest) for contract schemas to confirm acceptance/rejection of representative payloads.
5. Document change management: new channels require schema definitions, tests, and changelog entries. Include checklist in PR template.

## 7. Error Handling & Centralized Logging
1. Establish `services/logger.ts` exposing a singleton around `electron-log` with structured helpers (`info`, `warn`, `error`, `child` contexts).
2. Define error handling policy:
   - All async entry points (`main.ts`, preload, React query/mutation hooks) must `try/catch` and forward errors to central logger.
   - Use `process.on('unhandledRejection')` and `process.on('uncaughtException')` hooks to capture and log failures, then decide graceful shutdown vs. recovery.
   - Renderer: integrate an error boundary component to surface unexpected issues and route them to the logger via IPC.
3. Create `services/error-reporter.ts` to normalize errors, redact sensitive data, and optionally persist crash dumps for diagnostics.
4. Update documentation (`docs/operations.md`) with troubleshooting and log collection instructions.

## 8. FS/DB and Async Refactor Risks
1. Review database access in `services` (notably SQLite interactions) for synchronous patterns; plan migration to async worker threads or `better-sqlite3` transaction wrappers to avoid blocking the main thread.
2. Analyze file-system utilities and build scripts (`scripts/*.mjs`) for synchronous `fs` calls; queue conversions to async equivalents, ensuring path normalization and input sanitization.
3. Identify modules tightly coupling renderer and main logic; define clearer boundaries via domain services to limit blast radius when refactoring.
4. Risk register:
   - **Sync → Async regressions**: Mitigate by introducing integration tests with fake timers and instrumentation of long-running tasks.
   - **Schema drift**: Prevent by generating types from zod schemas and using shared exports.
   - **Logger migration**: Validate log output parity in staging before enabling structured logs in production builds.

## 9. Testing & CI Pipeline
1. Expand automated test suite:
   - Renderer unit tests with Vitest + React Testing Library focusing on hooks and utility modules.
   - IPC schema tests verifying validators and error propagation.
   - Smoke tests covering startup, menu actions, and persistence flows (can leverage Spectron alternative like Playwright component tests).
2. Update CI workflow:
   - Step 1: `npm ci`.
   - Step 2: `npm run lint`.
   - Step 3: `npm run typecheck` (alias to `tsc --noEmit`).
   - Step 4: `npm run test -- --run` (ensure tests run headless).
   - Step 5: `npm run build`.
   - Step 6: `npm run package:win:x64 -- --dir` and `npm run package:linux:x64 -- --dir` as smoke packaging (artifacts discarded).
   - Capture artifacts and upload logs for traceability.
3. Add branch protection rules requiring green CI and at least one code review for changes touching IPC or build scripts.

## 10. Tooling & Documentation Updates
- Introduce commit hooks via Husky to run lint and typecheck on staged files.
- Maintain `docs/quality-metrics.md` tracking lint debt, type errors, IPC coverage, and unhandled rejection audits.
- Update `CHANGELOG.md` whenever refactors alter APIs or IPC contracts.
- Provide developer onboarding guide covering new quality gates, command usage, and troubleshooting tips.

## 11. Timeline & Governance
- **Week 1-2**: TS config tightening, baseline fixes, initial lint setup.
- **Week 3-4**: IPC schema rollout and logging centralization.
- **Week 5-6**: Async refactors for heavy IO, finalize CI packaging smoke tests.
- Conduct bi-weekly quality reviews to assess metrics and adjust backlog.
- Any scope change triggers the governance cycle: update plan, re-derive tasks, and circulate for approval before implementation.

