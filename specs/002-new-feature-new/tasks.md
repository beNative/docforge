# Tasks: New from Clipboard Document Creation

**Input**: `/specs/002-new-feature-new/spec.md`
**Prerequisites**: `spec.md`, existing document creation flows in `App.tsx` and repository services.

**Tests**: Manual verification of clipboard-driven document creation per user stories. Add automated coverage where feasible for classification logic.

**Organization**: Tasks follow the implementation flow from platform plumbing to UI hooks and QA.

## Phase 0: Discovery & Platform Readiness

**Purpose**: Confirm baseline clipboard capabilities and classification utilities before building the new entry point.

- [ ] T001 Audit clipboard access pathways (`App.tsx`, `hooks/useNodes.ts`, `services/repository.ts`, Electron preload) to document current behavior and identify gaps for the new "New from clipboard" action (e.g., permission prompts, missing Electron bridge helpers).
- [ ] T002 Expand the manual QA checklist in `/docs/FUNCTIONAL_MANUAL.md` with notes on clipboard permission requirements (browser vs. Electron) so testers know how to unblock access when permissions are denied.

---

## Phase 1: Clipboard Service Enhancements (Shared Infrastructure)

**Purpose**: Provide a resilient, reusable API for reading clipboard payloads and normalizing text before document creation.

- [ ] T003 Create `services/clipboardService.ts` that wraps `navigator.clipboard.readText()` (renderer) and `electron.clipboard.readText()` (Electron) with consistent error handling, MIME filtering, and size guardrails (e.g., warn above 1 MB) returning `{ text, warnings, mimeType }`.
- [ ] T004 Expose a `readClipboardText` bridge in `electron/preload.ts`/`electron/main.ts` and update `window.electronAPI` typings so renderer code can fall back when `navigator.clipboard` is unavailable.
- [ ] T005 Add unit tests (Vitest) for the clipboard service mocking success, empty clipboard, permission errors, and oversize payloads to lock in edge-case handling.

---

## Phase 2: Classification & Repository Plumbing

**Purpose**: Automatically infer document metadata from clipboard content before persisting the node.

- [ ] T006 Update `services/classificationService.ts` to include heuristics for HTML vs. plain text preference, binary detection (guard against control characters), and to flag fallback scenarios in the returned `ClassificationSummary` warnings array.
- [ ] T007 Extend `types.ts` with a `ClipboardImportSummary` interface capturing inferred doc type, language, warnings, and fallback flags for logging/QA.
- [ ] T008 Implement `createDocumentFromClipboard` in `services/repository.ts` (and IPC/electron-side helpers as needed) to accept `{ parentId, content, titleHint }`, invoke the classifier, persist the new node with metadata (`doc_type_source`, `language_source`, `classification_updated_at`), and return `{ node, summary: ClipboardImportSummary }`.
- [ ] T009 Ensure undo/redo integration by inserting the creation into the existing history stack (`contexts/UndoRedoContext.tsx`) so the initial clipboard insertion can be reverted per FR-007.

---

## Phase 3: UI Integration – User Story 1 (Instant Clipboard Capture)

**Goal**: Allow users to trigger the feature from common creation surfaces and open the populated document immediately.

- [ ] T010 Add a "New from clipboard" command palette entry in `App.tsx` (and corresponding keyboard shortcut if available) that calls the clipboard service, propagates warnings via toast/log, and invokes the repository helper.
- [ ] T011 Surface the same action in the sidebar tree context menu and main toolbar dropdown, respecting the currently selected folder when determining `parentId`.
- [ ] T012 After creation, focus the new document tab, preserve clipboard formatting (no trimming), and append an info log entry summarizing detected doc type/language using the `ClipboardImportSummary` data.

---

## Phase 4: UI Integration – User Story 2 (Automatic Document Typing)

**Goal**: Make inferred metadata visible and correct for the common formats outlined in the spec.

- [ ] T013 Display a transient toast/banner when detection confidence < 0.5 or when fallbacks fire, informing the user that the document defaulted to plain text.
- [ ] T014 Update the document inspector or status bar (`components/DocumentMetadataBadge.tsx` or equivalent) to show the inferred doc type/language immediately after creation, including whether values were auto-detected.
- [ ] T015 Add regression tests (React Testing Library) ensuring Markdown, JSON, and TypeScript clipboard samples produce the expected metadata and logs.

---

## Phase 5: UI Integration – User Story 3 (Empty Clipboard Safety)

**Goal**: Provide actionable feedback when clipboard content cannot produce a document.

- [ ] T016 In the command handler, detect empty/whitespace clipboard content, surface a non-blocking toast (`addToast`) and log warning, and skip node creation.
- [ ] T017 Catch permission errors from the clipboard service and render a modal/dialog explaining how to grant access, linking to relevant OS instructions when running in Electron.
- [ ] T018 When binary or unsupported MIME types are detected, show a warning toast and avoid creating a document, logging the MIME type for diagnostics.

---

## Phase 6: QA, Telemetry, and Documentation

**Purpose**: Finalize the feature with logging, metrics, and documentation updates.

- [ ] T019 Instrument telemetry/logging (`services/analytics.ts` or existing logging hooks) to record clipboard document creations, including classification outcome and warning counts per SC-004.
- [ ] T020 Update `docs/FUNCTIONAL_MANUAL.md` and `docs/README.md` with end-user instructions for the new feature, including shortcuts and error messaging expectations.
- [ ] T021 Produce a manual QA checklist in `specs/002-new-feature-new/qa.md` (new file) covering success/edge scenarios: Markdown vs. JSON detection, empty clipboard handling, permission denial, large payload truncation, and HTML vs. plain text preference.

---

## Dependencies & Execution Order

- Phase 0 must complete before infrastructure and UI work to avoid duplicating existing clipboard pathways.
- Phase 1 lays the platform groundwork; Phases 2–5 depend on the shared clipboard service and classification plumbing.
- Phases 3–5 can progress in parallel once repository work (T008/T009) is code-complete.
- Phase 6 begins after functional acceptance tests pass and logs show expected metadata.

## Parallelization Notes

- Clipboard service tests (T005) can run alongside classification enhancements (T006) after the shared service API is defined.
- UI tasks within each phase (e.g., T010–T015) may be split between frontend contributors once the repository payload shape is finalized.
- Documentation and QA artifacts (Phase 6) may start while final UI polish (T013/T014) undergoes review, provided feature behavior is stable.
