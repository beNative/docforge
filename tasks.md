# DocForge Consolidation & Defect Hardening Backlog

_All tasks are sized for focused pull requests and include explicit acceptance coverage._

## Acceptance Legend
- `[x]` check is required for this task.
- `[ ]` check is not required.

---

## P0 — Quick Wins (Autofixable lint & simple typing gaps)
1. **Apply ESLint/Prettier autofixes and enforce zero-warning baseline**
   - Update ESLint config to set `maxWarnings: 0` (or minimal transitional threshold) and ensure Prettier integration.
   - Run `eslint --ext .ts,.tsx . --fix` and commit formatting-only changes.
   - Add `npm run lint` and `npm run format:check` scripts to package.json.
   - Acceptance checks: `[ ] tsc` | `[x] eslint` | `[ ] tests` | `[ ] build`

2. **Wire `tsc --noEmit` script and patch straightforward implicit `any/unknown` holes**
   - Add `npm run typecheck` script and ensure the command is usable in CI.
   - Annotate obvious type gaps (constants, contexts, simple utils) so current `tsc --noEmit` passes cleanly.
   - Document the command in CONTRIBUTING/README quickstart notes.
   - Acceptance checks: `[x] tsc` | `[ ] eslint` | `[ ] tests` | `[ ] build`

3. **Capture baseline CI recipe for lint + typecheck**
   - Update CI workflow (or add a new one) to run `npm run lint` and `npm run typecheck` on pull requests.
   - Surface failing status if either command reports an error or warning.
   - Acceptance checks: `[x] tsc` | `[x] eslint` | `[ ] tests` | `[ ] build`

---

## P1 — Stability & Coverage Enhancements
4. **Enable strict TypeScript options for renderer code and resolve resulting errors**
   - Set `strict`, `noImplicitOverride`, and `exactOptionalPropertyTypes` in `tsconfig.json`.
   - Address violations across `components/`, `hooks/`, and `contexts/` with minimal, localized refactors.
   - Acceptance checks: `[x] tsc` | `[ ] eslint` | `[ ] tests` | `[ ] build`

5. **Extend strict TypeScript coverage to Electron main/preload/services**
   - Fix typing issues in `electron/`, `services/`, and shared `types.ts` surfaced by strict mode.
   - Add missing return types and narrowings for filesystem/database helpers.
   - Acceptance checks: `[x] tsc` | `[ ] eslint` | `[ ] tests` | `[ ] build`

6. **Introduce targeted ESLint rules for promises and Electron security**
   - Enable rules such as `@typescript-eslint/no-floating-promises`, `promise/prefer-await-to-then`, and Electron security best practices.
   - Resolve remaining manual fixes left after autofix (e.g., missing `void` await, sanitized IPC usage).
   - Acceptance checks: `[ ] tsc` | `[x] eslint` | `[ ] tests` | `[ ] build`

7. **Establish Vitest smoke tests for utilities and IPC validators**
   - Add Vitest config, basic renderer utility tests, and placeholder IPC validator tests.
   - Ensure tests run in CI alongside lint/typecheck.
   - Acceptance checks: `[ ] tsc` | `[ ] eslint` | `[x] tests` | `[ ] build`

8. **Implement centralized error logging with rejection handling**
   - Create a shared logging module used by main, preload, and renderer.
   - Wrap async entry points to route unhandled rejections through the logger.
   - Acceptance checks: `[x] tsc` | `[x] eslint` | `[x] tests` | `[ ] build`

9. **Document IPC channels with request/response schemas**
   - Inventory existing IPC channels and describe payloads in docs or module-level comments.
   - Publish schema definitions to guide subsequent validation work.
   - Acceptance checks: `[ ] tsc` | `[ ] eslint` | `[ ] tests` | `[ ] build`

---

## P2 — Riskier Refactors & Build Confidence
10. **Introduce zod-based IPC validation shared between main and renderer**
    - Define schemas for each channel, infer TypeScript types from the schemas, and enforce validation before message dispatch.
    - Update IPC usage to rely solely on async patterns; remove synchronous IPC.
    - Acceptance checks: `[x] tsc` | `[x] eslint` | `[x] tests` | `[ ] build`

11. **Move long-running filesystem/database work off the Electron main thread**
    - Refactor blocking calls into worker threads or background processes with validated IPC bridges.
    - Add regression tests covering sanitized path handling and parameterized queries.
    - Acceptance checks: `[x] tsc` | `[x] eslint` | `[x] tests` | `[ ] build`

12. **Harden packaging for Windows and Linux with CI smoke builds**
    - Update `electron-builder` config or scripts to honor hardened preload settings.
    - Run `npm run package:win:x64` and `npm run package:linux:x64` in CI smoke jobs; capture artifact checksums.
    - Acceptance checks: `[ ] tsc` | `[ ] eslint` | `[ ] tests` | `[x] build`

13. **Clarify module boundaries and dependency seams**
    - Restructure shared utilities into clear domains (e.g., `ipc/`, `fs/`, `db/`) to reduce cross-module coupling.
    - Update import paths and add documentation describing ownership and contracts.
    - Acceptance checks: `[x] tsc` | `[x] eslint` | `[x] tests` | `[ ] build`

14. **Publish CHANGELOG entries for breaking refactors and new policies**
    - Summarize TypeScript strictness, IPC validation, and packaging changes with upgrade notes.
    - Link to evidence in QA log and plan documents.
    - Acceptance checks: `[ ] tsc` | `[ ] eslint` | `[ ] tests` | `[ ] build`
