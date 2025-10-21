# Cross-Artifact Analysis: Consolidation & Defect Hardening

## Findings

| Location | Severity | Rationale | Suggested Fix | Backlog Alignment |
| --- | --- | --- | --- | --- |
| `plan.md`:15 vs `tsconfig.json`:9-15 | Low | The plan’s baseline still claims strict typing is disabled, but the repo already enables `strict`, `noImplicitOverride`, and `exactOptionalPropertyTypes`, which can confuse governance checkpoints. | Refresh the baseline narrative to reflect the new compiler posture and highlight the remaining gaps (`noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`). | Update documentation alongside P1 Task 4 so stakeholders track the true delta.
| `tsconfig.json`:9-15 & Spec FR-001 | Medium | FR-001 calls for “strict plus complementary flags such as `noUncheckedIndexedAccess`,” yet the config omits both `noUncheckedIndexedAccess` and `noFallthroughCasesInSwitch`, allowing unchecked property access paths to persist. | Extend the compiler options with the missing strictness flags and re-run `tsc --noEmit` to catalogue follow-up fixes. | P1 Task 4 (strict renderer) + P1 Task 5 (strict main/services).
| `package.json`:7-24 | Medium | Acceptance criteria require `eslint .` with zero warnings, but there are no lint/typecheck scripts or ESLint configuration, leaving CI without enforcement hooks. | Add ESLint/Prettier config files, wire `npm run lint`, `npm run lint:fix`, and `npm run typecheck`, and integrate them into the CI recipe. | P0 Task 1 (lint autofix), P0 Task 2 (typecheck script), P0 Task 3 (CI recipe).
| `electron/preload.ts`:30-141 | High | The preload bridge exposes numerous IPC channels with `any` payloads and no schema enforcement, so the renderer can send arbitrary SQL, filesystem paths, or Python commands into the main process. | Stand up shared Zod contracts, infer types for the preload surface, and reject payloads that fail validation before they reach `ipcMain`. | P1 Task 9 (document IPC) → P2 Task 10 (Zod validation).
| `electron/main.ts`:22-134 | High | Main-process helpers forward renderer data directly (e.g., `broadcastPythonEvent`, database invocations) without validating types, and there is still no `process.on('unhandledRejection')`, so async failures or malformed payloads bypass the planned safety net. | Introduce centralized validation/dispatch utilities that parse payloads, add rejection/exception hooks through the logger, and align handlers with the upcoming contracts. | P1 Task 8 (centralized logging) + P2 Task 10 (IPC validation).
| `electron/database.ts`:488-553 | High | Database helpers accept `any[]` parameters and return `any`, while migration paths execute raw SQL with renderer-provided values, undermining strict typing and parameterization goals. | Model query DTOs, require structured parameter objects, and refactor migrations to sanitize/parameterize inputs before execution. | P1 Task 5 (strict services) + P2 Task 11 (async-safe DB/FS refactors).

## Notes
- Validate that follow-on task breakdowns reference these specific gaps so workstreams can be scoped accurately.
- Re-run planning once documentation corrections (e.g., strictness baseline) are merged per governance policy.
