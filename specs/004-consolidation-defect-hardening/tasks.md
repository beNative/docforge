# Task Breakdown: Consolidation & Defect Hardening

## Governance Workflow

1. Review this specification with platform engineering, security, and release stakeholders.
2. Produce an implementation plan sequencing typing, lint, IPC, runtime, and packaging updates before coding begins.
3. If scope or acceptance criteria change, re-run the Spec Kit governance loop (plan → tasks → analyze) prior to further
   implementation.

## Workstreams & Tasks

### 1. TypeScript Consolidation
- Update `tsconfig.json` to enable `strict: true` plus companion safety flags.
- Sweep application, Electron, and Spec Kit TypeScript sources to remediate new diagnostics.
- Add or update `npm run typecheck` and wire `tsc --noEmit` into CI jobs.
- Remove obsolete types and annotate intentional gaps with `@ts-expect-error` plus tracked follow-ups.
- Reintroduce `services/preview` fixtures and Vitest configs into the strict typecheck once outstanding errors are resolved or
  isolated behind dedicated configs.

### 2. Lint & Format Zero-Warning Policy
- Standardize ESLint + Prettier configuration (plugins, ignore lists, parser options).
- Enforce `eslint --max-warnings 0` in CI and local scripts.
- Create or update `npm run lint`, `npm run format`, and `npm run format:check` commands.
- Document lint/format workflow and remediation steps in contributor guides.

### 3. IPC Documentation & Validation
- Inventory all IPC channels in Electron main/preload layers.
- Author shared schema modules (e.g., Zod) for each request/response payload.
- Update handlers to validate payloads and emit structured errors on failure.
- Publish channel documentation (tables, diagrams) in `docs/` and/or this spec folder.
- Add Vitest smoke tests covering valid/invalid payloads for every channel.

### 4. Error Handling & Rejection Mitigation
- Establish or extend a centralized error/logging service accessible from renderer, preload, and main contexts.
- Refactor async flows to route errors through the service and eliminate unhandled promise rejections.
- Implement structured logging with redaction utilities.
- Capture integration tests or QA scenarios demonstrating rejection handling.

### 5. Packaging Reliability (Windows & Linux)
- Review build scripts and ensure they reference hardened preload and configuration artifacts.
- Validate `npm run package:win` and `npm run package:linux` locally and in CI matrix builds.
- Document prerequisites, artifact locations, and checksum procedures.
- Capture failure triage steps for release engineering playbooks.

### 6. Documentation & Change Management
- Update `CHANGELOG.md` with breaking refactors, migration notes, and mitigation strategies.
- Refresh contributor and technical manuals with new policies (TypeScript, lint, IPC validation, error handling).
- Ensure docs under `docs/` mirror root-level updates per constitution quality gate.

### 7. QA Evidence & Monitoring
- Record typecheck, lint, test, and packaging run outputs in `qa.md`.
- Log security/IP validation review sign-offs.
- Monitor logs post-deployment for unhandled rejection entries and archive findings.

## Completion Definition

Workstreams are complete when:
- CI demonstrates passing runs for `npm run typecheck`, `npm run lint`, `npm run format:check`, relevant Vitest suites, and
  Windows/Linux packaging jobs.
- IPC documentation matches implemented channels and validation tests cover both success and failure paths.
- `CHANGELOG.md` and contributor docs reflect all breaking changes and new policies.
- QA evidence and stakeholder sign-offs are captured within `specs/004-consolidation-defect-hardening/qa.md`.

