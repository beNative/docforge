# Tasks: Auto-detect document language when nodes are created from external content

**Input**: Design documents from `/specs/001-auto-detect-node/`
**Prerequisites**: spec.md

**Tests**: Manual verification per user stories. Automated tests optional unless noted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared classification primitives used by all import workflows.

- [ ] T001 Define document classification metadata types (e.g., `DocumentClassificationSource`, `DocumentClassificationResult`) in `types.ts`, extending document- and transfer-related interfaces to carry source flags and detection summaries.
- [ ] T002 Create `shared/documentClassification.ts` with reusable heuristics (extension, filename cues, shebang/content sniffing, MIME detection) that returns language, doc type, default view mode, and confidence/source metadata for both renderer and Electron contexts.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persist and expose classification metadata across environments.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Add schema support for classification metadata: introduce a migration (e.g., `electron/migrations/002_document_classification.sql`) and update `electron/schema.ts` plus setup logic in `electron/database.ts` to store `language_source`, `doc_type_source`, and detection timestamps with safe defaults for existing rows.
- [ ] T004 Update data plumbing to honor new metadata: ensure `electron/database.ts`, `services/repository.ts`, `hooks/usePrompts.ts`, and browser-state helpers persist, retrieve, and hydrate classification fields, while normalizing legacy records via the shared classifier.

**Checkpoint**: Repository returns documents with accurate classification sources available to the UI.

---

## Phase 3: User Story 1 - Paste clipboard text into a new node (Priority: P1) 🎯 MVP

**Goal**: When a user pastes clipboard text as a new document, DocForge auto-detects language/doc type, sets the default view, and surfaces the classification result without manual tweaks.

**Independent Test**: Paste representative TypeScript, JSON, and Markdown snippets via "Paste as Document" and verify each opens with correct doc type, language badge, and default view logged to the activity panel without further changes.

### Implementation for User Story 1

- [ ] T005 [US1] Implement `createDocumentFromClipboard` in `services/repository.ts` to accept clipboard payloads, invoke the shared classifier, persist auto-detected doc type/language/default view with `language_source = 'auto'`, and return a detection summary for logging.
- [ ] T006 [US1] Wire a "Paste as Document" action into `App.tsx` (command palette, sidebar context menu, and keyboard shortcut if available) that reads clipboard data, optionally asks for a filename hint, calls the new repository helper, refreshes the tree, and logs the classifier summary via `useLogger`.
- [ ] T007 [US1] Handle clipboard edge cases: surface warnings for binary/empty payloads in `App.tsx` and ensure classification fallbacks default to Markdown/plaintext without crashing, matching spec edge cases.

**Checkpoint**: Pasted documents open in the correct mode with a visible log entry summarizing the inferred classification.

---

## Phase 4: User Story 2 - Drag & drop DocForge nodes without metadata (Priority: P2)

**Goal**: Imported `DraggedNodeTransfer` payloads missing metadata are reclassified so nodes behave like their originals.

**Independent Test**: Import nodes titled `analysis.py`, `diagram.puml`, and an SVG-only node lacking metadata; confirm doc type, language hint, and default view are inferred and logged.

### Implementation for User Story 2

- [ ] T008 [US2] Update the renderer-side path in `services/repository.ts` to re-run classification for `DraggedNodeTransfer` entries lacking doc type or language, tagging results with `*_source = 'auto'` while leaving existing metadata untouched.
- [ ] T009 [US2] Extend `electron/database.ts` (and its IPC bridge) so `dbInsertNodesFromTransfer` applies the shared classifier when metadata is absent, persists source flags, and sets preview defaults for PDFs/images.
- [ ] T010 [US2] Emit structured import logs in `hooks/useNodes.ts` or `App.tsx` summarizing how many nodes were reclassified versus preserved, aiding manual QA per story test.

**Checkpoint**: Dropped nodes without metadata reopen with accurate previews and logged classification details.

---

## Phase 5: User Story 3 - Preserve manual overrides (Priority: P3)

**Goal**: Manual language/doc-type changes persist and suppress future auto-reclassification unless explicitly requested.

**Independent Test**: Override an auto-detected JSON document to YAML, move or reopen it, and verify the override sticks; subsequent imports still auto-classify new items.

### Implementation for User Story 3

- [ ] T011 [US3] Mark manual overrides in `handleLanguageChange` and `services/repository.ts` so updates set `language_source = 'user'` (and similar for doc type when applicable), persisting the flag in both Electron and browser stores.
- [ ] T012 [US3] Guard all classification entry points (clipboard creation, node transfer import, file import) to skip reclassification when `*_source` is `'user'`, ensuring overrides remain intact across refreshes and duplicates.
- [ ] T013 [US3] Add a lightweight document inspector element in `components/PromptEditor.tsx` (or a dedicated metadata panel) that displays doc type, language, and whether the values were auto-detected or user-set, matching FR-004 visibility requirements.

**Checkpoint**: Manual overrides survive future imports/edits and the UI clearly indicates when values were auto-detected versus user-selected.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, QA artifacts, and finishing touches.

- [ ] T014 Update `docs/FUNCTIONAL_MANUAL.md` and `docs/TECHNICAL_MANUAL.md` to describe the auto-detection workflow, supported formats, override behavior, and logging expectations.
- [ ] T015 Add manual QA steps to `docs/gui-test-plan-report.md` (or a new checklist) covering clipboard detection, node import reclassification, and manual override regression scenarios.

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: Classification types and heuristics must exist before schema/data plumbing.
- **Phase 2 → Phases 3-5**: Persistence updates are prerequisite for user stories; do not start story work until repository returns source metadata.
- **User Stories**: US1 (P1) should ship first; US2 can begin once Phase 2 completes; US3 depends on US1/US2 plumbing for override guards.
- **Polish**: Documentation updates land after functional work stabilizes.

## Parallel Opportunities

- Within Phase 1, tasks cannot run in parallel due to type dependencies.
- After Phase 2 completes, US2 work (T008–T010) can proceed in parallel with US1 logging polish (post T006) if staffing allows.
- Documentation polish (Phase 6) can overlap with late-stage regression testing once functional changes are code-complete.

## Implementation Strategy

1. Build and validate the shared classifier plus persistence layer (Phases 1-2).
2. Deliver the MVP clipboard flow (US1) to satisfy priority P1 and unlock early feedback.
3. Extend classification to drag/drop imports (US2), leveraging the same utilities for consistency.
4. Harden manual override handling and expose classification metadata in the UI (US3).
5. Finalize documentation and QA materials to support release readiness (Phase 6).
