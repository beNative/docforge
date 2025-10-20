<!--
Sync Impact Report:
- Version: (new) → 1.0.0
- Modified principles: initial publication
- Added sections: Core Principles; Quality Gates; Development Workflow
- Templates requiring updates: ✅ .specify/templates/spec-template.md (reviewed)
  ✅ .specify/templates/plan-template.md (reviewed)
  ✅ .specify/templates/tasks-template.md (reviewed)
- Follow-up TODOs: None
-->
# DocForge Constitution

## Core Principles

### I. Offline-First Reliability
DocForge MUST preserve full functionality without an internet connection. All features shipped to end users SHALL operate exclusively on local data stores and services, relying on the bundled SQLite database, local LLM providers, and on-device assets. Any external integration MUST provide an offline fallback path and clear guidance before being accepted.

### II. Document Integrity & Auditability
Every change to user-authored content MUST be traceable. The SQLite schema, repository layer, and UI workflows SHALL guarantee durable storage, reversible history, and explicit diff views. Automated migrations MUST be deterministic, idempotent, and versioned so that users can recover from failure without data loss.

### III. Experience Consistency & Accessibility
The React renderer, Monaco editor configuration, and Electron shell MUST deliver a consistent experience across Windows, macOS, and Linux. Keyboard navigation, drag-and-drop, theming, and window chrome SHALL remain aligned with the functional manual. UI regressions that break parity or introduce accessibility barriers are blocking defects.

### IV. Observability & Diagnostics
Action logging, status reporting, and error surfaces MUST remain intact to support supportability. Changes to logging pipelines SHALL maintain the structured log contract consumed by the diagnostics panel. Performance degradations (initial load, tree navigation, editing responsiveness) MUST be measured and documented before merging.

### V. Spec-Driven Delivery
Feature work MUST begin from a validated specification stored in `specs/`. The Spec Kit workflow (constitution, specify, plan, tasks, implement) SHALL be the canonical path for defining scope, acceptance, and tasks. Implementation MAY NOT start until the feature specification, plan, and task list have been reviewed and committed.

## Quality Gates

1. **Documentation parity:** Updates to root Markdown files MUST be mirrored under `docs/` before release branches cut.
2. **Testing discipline:** Automated validation scripts (`npm run test`, GUI plan validator, release workflow tests) MUST remain green before merging feature branches.
3. **Database safety:** Schema or repository changes SHALL include migration notes and downgrade considerations in the associated specification.
4. **UI verification:** Visual changes MUST include before/after context (screenshots or recorded diffs) and cover keyboard/assistive scenarios in acceptance criteria.

## Development Workflow

1. **Specification lifecycle:**
   - `/speckit.constitution` governs future amendments to this document.
   - `/speckit.specify` captures feature intent and user stories in `specs/<id>/spec.md`.
   - `/speckit.plan` records architectural decisions and risk analysis in `specs/<id>/plan.md`.
   - `/speckit.tasks` expands the plan into executable work tracked alongside spec artifacts.
   - `/speckit.implement` MAY be used to scaffold code once the prior artifacts are approved.
2. **Script support:** The helper scripts under `.specify/scripts/` (bash and PowerShell) SHALL remain executable and are the preferred interface for generating new specs (`create-new-feature.sh`) and refreshing agent context (`update-agent-context.sh`).
3. **Branch discipline:** Feature branches MUST be named using the generated `NNN-slug` convention to preserve ordering and traceability.
4. **Reviews & sign-off:** Pull requests SHALL link to the corresponding spec folder and explicitly call out acceptance criteria coverage, test evidence, and documentation updates.

## Governance

- The constitution supersedes ad-hoc practices. Amendments require consensus from maintainers, a documented rationale in the spec folder, and a semantic version bump recorded below.
- Compliance checks (documentation parity, test coverage, UX review) MUST be confirmed during code review; deviations SHALL include follow-up tasks before merging.
- Breaking changes to principles (removal or major reinterpretation) trigger a MAJOR version bump; new mandates or expanded guidance require a MINOR bump; clarifications or typo fixes use PATCH bumps.

**Version**: 1.0.0 | **Ratified**: 2025-10-20 | **Last Amended**: 2025-10-20
