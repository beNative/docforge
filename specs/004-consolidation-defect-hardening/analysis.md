# Cross-Artifact Analysis: Consolidation & Defect Hardening

## Findings

| Location | Severity | Rationale | Suggested Fix | Backlog Alignment |
| --- | --- | --- | --- | --- |
| `plan.md`:15 vs `tsconfig.json`:9-13 | Low | The plan states strict TypeScript is not enabled, but the repo already has `"strict": true`, risking confusion when tracking remaining work. | Update the baseline section to reflect current compiler flags and explicitly call out the missing options (`noImplicitOverride`, `exactOptionalPropertyTypes`, etc.). | Update documentation alongside P1 Task 4 before implementation kicks off.
| `tsconfig.json`:9-13 | Medium | Spec FR-001 requires `noImplicitOverride` and `exactOptionalPropertyTypes`, but the compiler options only set `strict`, leaving gaps strict mode is meant to cover. | Extend the config with the missing flags and run `tsc --noEmit` to catalogue new diagnostics. | P1 Task 4 (strict renderer) + P1 Task 5 (strict main/services).
| `electron/preload.ts`:32-140 & `types.ts`:8-72 | High | IPC bridge exposes dozens of channels with `any` payloads and no validation, violating the spec’s schema requirement and enabling unsafe main-process calls. | Introduce shared zod schemas, infer types for preload exports, and replace `any` annotations with typed contracts. | P1 Task 9 (document IPC) → P2 Task 10 (zod validation).
| `electron/main.ts`:380-483 | High | Handlers forward renderer-provided SQL/file paths directly to database service without schema/permission checks, contradicting the IPC validation plan and increasing injection risk. | Validate inputs against shared schemas before invoking `databaseService`, reject malformed payloads, and audit call sites for parameterization. | P1 Task 9 & P2 Task 10, plus P2 Task 11 for FS/DB safety.
| `electron/database.ts`:487-560 | High | Database API accepts `any[]` parameters and returns `any`, preventing strict type coverage and hiding unsafe SQL composition paths noted in the plan. | Define typed DTOs for query results, require structured parameter objects, and enforce parameterized statements in repository callers. | P1 Task 5 (strict main/services) + P2 Task 11 (async-safe DB refactors).
| `electron/main.ts`:35-59 | Medium | The plan mandates catching unhandled promise rejections, but only `log.catchErrors` is configured; there is no `process.on('unhandledRejection')`, leaving async failures untracked. | Add centralized hooks for `unhandledRejection`/`uncaughtException` routing through the planned logger, and document policy in ops guides. | P1 Task 8 (centralized error logging).
| Repo-wide (no ESLint config or scripts) | Medium | Acceptance criteria demand `eslint .` with zero warnings, yet `package.json` lacks lint scripts/config, so CI can’t enforce lint baselines. | Add root ESLint/Prettier config, wire `npm run lint`/`lint:fix`, and update tasks.md quick wins accordingly. | P0 Task 1 (lint autofix) & P0 Task 3 (CI recipe).

## Notes
- Validate that follow-on task breakdowns reference these specific gaps so workstreams can be scoped accurately.
- Re-run planning once documentation corrections (e.g., strictness baseline) are merged per governance policy.
