# Tasks: New from Clipboard Document Creation

## Architecture
**Definition of Done**
- Clipboard reads traverse the preload bridge with explicit error typing for renderer consumers.
- Document creation orchestrator persists clipboard imports, focuses the editor, and records undo history hooks.
- Classification heuristics execute before YAML checks and expose warnings for UX surfacing.

- [ ] **T-ARCH-01 – Harden clipboard acquisition bridge**  \
  **FRs:** FR-002, FR-006  \
  **Scope:** Implement Electron main ↔ preload handlers that forward clipboard read requests with structured `{ kind, text?, reason? }` payloads and size guardrails.  \
  **Acceptance Checks:** `npm run build`, `npm run lint`  \
  **Risk:** P0 (clipboard access is prerequisite for every workflow)
- [ ] **T-ARCH-02 – Document bootstrap workflow**  \
  **FRs:** FR-003, FR-005, FR-007  \
  **Scope:** Extend repository/app core to insert clipboard-backed documents into the active folder, push undo entries, and trigger editor focus events.  \
  **Acceptance Checks:** `npm run build`, `npm run test -- --runInBand --filter clipboard-document`  \
  **Risk:** P0 (impacts data integrity and undo stack)
- [ ] **T-ARCH-03 – Error signaling across environments**  \
  **FRs:** FR-002, FR-006  \
  **Scope:** Normalize renderer fallbacks for browsers lacking `navigator.clipboard`, mapping OS permission errors into typed causes for UI handling.  \
  **Acceptance Checks:** `npm run build`, `npm run test -- --runInBand --filter clipboard-service`  \
  **Risk:** P1 (affects degraded environments)
- [ ] **T-ARCH-04 – Classification heuristics refinement**  \
  **FRs:** FR-004  \
  **Scope:** Update classifier ordering to evaluate HTML signatures before YAML and emit warning metadata for ambiguous matches.  \
  **Acceptance Checks:** `npm run build`, `npm run test -- --runInBand --filter classification`  \
  **Risk:** P1 (precision defects degrade UX)

## Data / Contracts
**Definition of Done**
- Clipboard service typings exported for renderer/main parity.
- Repository returns `ClipboardImportSummary` capturing doc type, language, and warning signals.
- Undo payload schema documents clipboard origin metadata.

- [ ] **T-DATA-01 – ClipboardService contract**  \
  **FRs:** FR-002, FR-006  \
  **Scope:** Define TypeScript interfaces for clipboard responses and update `window.electronAPI` typings to surface the structured results.  \
  **Acceptance Checks:** `npm run build`, `npm run typecheck`  \
  **Risk:** P1 (type drift blocks integration)
- [ ] **T-DATA-02 – Document node initialization schema**  \
  **FRs:** FR-003, FR-005, FR-007  \
  **Scope:** Extend `DocumentNode` contracts to record clipboard origin flags, inferred metadata, and undo tokens consumed by the bootstrap workflow.  \
  **Acceptance Checks:** `npm run build`, `npm run test -- --runInBand --filter repository`  \
  **Risk:** P0 (schema gaps break persistence/undo)

## UI
**Definition of Done**
- Command palette, sidebar toolbar, and folder overview expose "New from clipboard" aligned with active folder context.
- Editor auto-focuses new documents and surfaces detection warnings via InfoModal/Toast patterns.
- UX gracefully handles empty clipboard, permission denial, and unsupported MIME types.

- [ ] **T-UI-01 – Command palette entrypoint**  \
  **FRs:** FR-001, FR-005  \
  **Scope:** Wire clipboard creation handler into the command palette (and shortcut if available), ensuring the resulting document opens immediately.  \
  **Acceptance Checks:** `npm run build`, `npm run test -- --runInBand --filter command-palette`  \
  **Risk:** P1 (missing entrypoint blocks discovery)
- [ ] **T-UI-02 – Treeview & folder overview actions**  \
  **FRs:** FR-001, FR-003, FR-005  \
  **Scope:** Add toolbar/context menu buttons for sidebar and folder overview panes that pass the correct parent folder when invoking the bootstrap workflow.  \
  **Acceptance Checks:** `npm run build`, `npm run test -- --runInBand --filter sidebar`  \
  **Risk:** P1 (navigation regressions disrupt authoring)
- [ ] **T-UI-03 – Clipboard error UX**  \
  **FRs:** FR-006  \
  **Scope:** Display InfoModal/toast guidance for empty clipboard, permission denial, or unsupported MIME detections without creating documents.  \
  **Acceptance Checks:** `npm run build`, `npm run test -- --runInBand --filter clipboard-errors`  \
  **Risk:** P1 (poor messaging confuses users)

## Test / CI
**Definition of Done**
- Automated coverage protects clipboard service success/failure permutations.
- Classification regression tests verify HTML vs. YAML prioritization and supported syntax formats.
- End-to-end flow exercises every entrypoint and confirms undo capability.

- [ ] **T-TEST-01 – Clipboard service unit tests**  \
  **FRs:** FR-002, FR-006  \
  **Scope:** Mock Electron and web clipboard responses (success, empty, permission denied, oversize) validating structured outputs.  \
  **Acceptance Checks:** `npm run test -- --runInBand --filter clipboard-service`, `npm run lint`  \
  **Risk:** P1 (test gaps allow regressions)
- [ ] **T-TEST-02 – Classification regression suite**  \
  **FRs:** FR-004  \
  **Scope:** Add fixtures for HTML, Markdown, JSON, YAML, and plain text, ensuring heuristics detect HTML prior to YAML and emit warnings on ambiguity.  \
  **Acceptance Checks:** `npm run test -- --runInBand --filter classification`, `npm run build`  \
  **Risk:** P1 (heuristic regressions degrade accuracy)
- [ ] **T-TEST-03 – End-to-end clipboard creation flow**  \
  **FRs:** FR-001, FR-003, FR-005, FR-007  \
  **Scope:** Script UI automation covering command palette, sidebar toolbar, and folder overview actions; verify editor focus and undo entry existence.  \
  **Acceptance Checks:** `npm run test:e2e`, `npm run build`  \
  **Risk:** P0 (breakages block release confidence)

## Release
**Definition of Done**
- Documentation and telemetry updated to capture clipboard sourcing behavior.
- Cross-platform validation confirms clipboard access reliability before GA.

- [ ] **T-REL-01 – Telemetry & documentation updates**  \
  **FRs:** FR-008  \
  **Scope:** Instrument logging for clipboard document creation, update functional manual, and add release notes describing the feature.  \
  **Acceptance Checks:** `npm run build`, documentation review checklist  \
  **Risk:** P2 (missing docs reduce support readiness)
- [ ] **T-REL-02 – Cross-platform validation**  \
  **FRs:** FR-002, FR-006  \
  **Scope:** Execute smoke validation on Windows/macOS/Linux builds ensuring clipboard permissions and messaging behave consistently.  \
  **Acceptance Checks:** QA sign-off checklist, `npm run build`  \
  **Risk:** P1 (platform issues block release)

## FR Coverage
| FR | Task IDs |
| --- | --- |
| FR-001 | T-UI-01, T-UI-02, T-TEST-03 |
| FR-002 | T-ARCH-01, T-ARCH-03, T-DATA-01, T-TEST-01, T-REL-02 |
| FR-003 | T-ARCH-02, T-DATA-02, T-UI-02, T-TEST-03 |
| FR-004 | T-ARCH-04, T-TEST-02 |
| FR-005 | T-ARCH-02, T-UI-01, T-UI-02, T-TEST-03 |
| FR-006 | T-ARCH-01, T-ARCH-03, T-DATA-01, T-UI-03, T-TEST-01, T-REL-02 |
| FR-007 | T-ARCH-02, T-DATA-02, T-TEST-03 |
| FR-008 | T-REL-01 |
