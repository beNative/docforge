# Implementation Plan: New Document from Clipboard

## Architecture
- **Clipboard acquisition pipeline** (FR-002, FR-006) — Owner: Platform Engineering. **Input**: user-initiated "New from clipboard" IPC request plus host OS clipboard contents. **Output**: sanitized text payload or structured clipboard error forwarded through the preload bridge to the renderer, with failure reasons encoded for UX handling. (Task IDs: T-ARCH-01, T-ARCH-03)
- **Document bootstrap workflow** (FR-003, FR-005, FR-007) — Owner: Application Core. **Input**: clipboard payload + active folder metadata + inferred document type. **Output**: persisted document node with initial revision captured in undo stack and focus event dispatched to editor to open the new document. (Task IDs: T-ARCH-02, T-DATA-02)
- **Classification heuristics refinement** (FR-004) — Owner: Platform Engineering. **Input**: raw clipboard text with mime hints. **Output**: deterministic classification result prioritizing HTML signature detection ahead of YAML patterns, including extensibility hooks for future content types. (Task IDs: T-ARCH-04)

## Data / Contracts
- **ClipboardService contract** (FR-002, FR-006) — Owner: Platform Engineering. **Input**: renderer bridge call signature (`readClipboardText(options)`), OS capability signals. **Output**: TypeScript interface describing promise resolution structure `{ kind: 'success' | 'error'; text?: string; reason?: ClipboardError }` consumed by the document creation handler. (Task IDs: T-DATA-01)
- **DocumentNode initialization schema** (FR-003, FR-007) — Owner: Application Core. **Input**: active folder ID, generated slug/name, classification result. **Output**: normalized `DocumentNode` payload with timestamps, undo metadata, and analytics tags for clipboard origin. (Task IDs: T-DATA-02)

## UI
- **Command palette & treeview entrypoints** (FR-001, FR-005) — Owner: Frontend Guild. **Input**: clipboard creation handler injected into command palette, sidebar toolbar, and folder overview toolbar components. **Output**: visible "New from clipboard" affordances wired to invoke document bootstrap flow and auto-focus the resulting editor tab. (Task IDs: T-UI-01, T-UI-02)
- **Clipboard error UX** (FR-006) — Owner: Frontend Guild. **Input**: structured clipboard failure payload. **Output**: InfoModal/Toast messaging that blocks empty document creation while guiding the user to retry or adjust permissions. (Task IDs: T-UI-03)

## Test / CI
- **Clipboard read service tests** (FR-002, FR-006) — Owner: QA Automation. **Input**: mocked Electron clipboard responses (success, empty, permission denied). **Output**: unit coverage verifying service resolves with expected payloads and error messaging. (Task IDs: T-TEST-01)
- **Classification regression suite** (FR-004) — Owner: QA Automation. **Input**: representative clipboard fixtures (HTML, Markdown, JSON, YAML, plain text). **Output**: automated assertions ensuring HTML prioritization over YAML and correct defaulting behavior. (Task IDs: T-TEST-02)
- **End-to-end creation flow** (FR-001, FR-003, FR-005, FR-007) — Owner: QA Automation. **Input**: scripted UI interactions across toolbar locations. **Output**: smoke tests confirming document creation, auto-open, and undo availability without flaky timing. (Task IDs: T-TEST-03)

## Release
- **Activity logging & documentation** (FR-008) — Owner: Release Engineering. **Input**: clipboard creation events with document metadata. **Output**: telemetry entries plus updated functional manual and release notes covering clipboard sourcing. (Task IDs: T-REL-01)
- **Cross-platform validation** (FR-002, FR-006) — Owner: Release Engineering. **Input**: installer builds for Windows/macOS/Linux with clipboard feature enabled. **Output**: sign-off checklist confirming no OS-specific clipboard crashes prior to GA. (Task IDs: T-REL-02)

## Plan → Tasks Contract
| FR | Plan Section(s) | Upcoming Task IDs |
| --- | --- | --- |
| FR-001 | UI, Test / CI | T-UI-01, T-UI-02, T-TEST-03 |
| FR-002 | Architecture, Data / Contracts, Test / CI, Release | T-ARCH-01, T-ARCH-03, T-DATA-01, T-TEST-01, T-REL-02 |
| FR-003 | Architecture, Data / Contracts, Test / CI | T-ARCH-02, T-DATA-02, T-TEST-03 |
| FR-004 | Architecture, Test / CI | T-ARCH-04, T-TEST-02 |
| FR-005 | Architecture, UI, Test / CI | T-ARCH-02, T-UI-01, T-UI-02, T-TEST-03 |
| FR-006 | Architecture, Data / Contracts, UI, Test / CI, Release | T-ARCH-01, T-ARCH-03, T-DATA-01, T-UI-03, T-TEST-01, T-REL-02 |
| FR-007 | Architecture, Data / Contracts, Test / CI | T-ARCH-02, T-DATA-02, T-TEST-03 |
| FR-008 | Release | T-REL-01 |
