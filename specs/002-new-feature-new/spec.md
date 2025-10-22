# Feature Specification: New Document from Clipboard

**Feature Branch**: `002-new-feature-new`
**Created**: 2024-05-21
**Status**: Draft
**Input**: User description: "Add a new feature 'New from clipboard' which will create a new document node with the content on the clipboard in it. The document type should be automatically guessed aswell"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant clipboard capture (Priority: P1)

As a writer collecting research snippets, I want to create a new document directly from my clipboard so that I can save copied content without manually pasting into a blank document.

**Why this priority**: Capturing clipboard content in a single action removes the friction of creating and populating a document, enabling the fastest path to value for the feature.

**Independent Test**: Trigger the "New from clipboard" action while non-empty text is on the clipboard and verify the new document opens pre-populated with that content.

**Acceptance Scenarios**:

1. **Given** a user has textual content on the clipboard, **When** they invoke "New from clipboard" from the command palette or context menu, **Then** DocForge creates a new document node pre-filled with the clipboard content and opens it in the editor.
2. **Given** a user selects "New from clipboard" with clipboard content containing line breaks and indentation, **When** the document opens, **Then** the formatting is preserved exactly as copied.

---

### User Story 2 - Automatic document typing (Priority: P1)

As a developer copying code, I want DocForge to guess the document type from the clipboard content so that syntax highlighting and previews work immediately.

**Why this priority**: Correctly guessing the document type makes the new document immediately useful and reduces manual adjustments, which are core to the requested feature.

**Independent Test**: Copy representative content (Markdown, JSON, TypeScript, plain text) to the clipboard, run the feature, and confirm the new node and editor mode match the detected type.

**Acceptance Scenarios**:

1. **Given** the clipboard holds Markdown content, **When** the user runs "New from clipboard", **Then** the new document is created with type Markdown and the Markdown editor features (preview, formatting tools) are available.
2. **Given** the clipboard holds JSON content, **When** the feature runs, **Then** the new document type is JSON and JSON formatting tools are available.
3. **Given** the clipboard holds content that does not match any specialized type, **When** the feature runs, **Then** the document defaults to plain text without errors.

---

### User Story 3 - Empty clipboard safety (Priority: P2)

As a user who may forget what is currently copied, I want a helpful message when the clipboard is empty or inaccessible so that I understand why a document was not created.

**Why this priority**: Handling empty or restricted clipboards prevents confusing blank documents and reduces support burden, while still being secondary to the core capture flow.

**Independent Test**: Clear the clipboard (or simulate failure), invoke the feature, and confirm DocForge surfaces a non-blocking error message without creating a new document.

**Acceptance Scenarios**:

1. **Given** the clipboard has no readable content, **When** the user tries "New from clipboard", **Then** DocForge shows a toast or dialog explaining the clipboard is empty and no document is created.
2. **Given** the OS denies clipboard access, **When** the feature runs, **Then** DocForge reports the permission issue and does not create an empty document.

---

### Edge Cases

- What happens when clipboard content is extremely large (e.g., >1 MB)?
- How does system handle binary or image clipboard data? Provide a clear error or skip unsupported formats.
- How to proceed when clipboard contains mixed HTML and plain text? Ensure the preferred representation is selected.
- What happens when an existing document name conflict occurs (e.g., default naming scheme) during rapid successive creations?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose a "New from clipboard" action in the command palette and any existing "New document" UI entry points (e.g., toolbar, sidebar context menu).
- **FR-002**: System MUST read textual clipboard content using the operating system clipboard APIs available in the Electron shell.
- **FR-003**: System MUST create a new document node populated with the clipboard text and insert it into the active folder of the workspace tree.
- **FR-004**: System MUST automatically determine the document type based on clipboard content heuristics (e.g., file extension hints in metadata, syntax detection, or content analysis).
- **FR-005**: System MUST open the newly created document in the editor immediately after creation.
- **FR-006**: System MUST handle clipboard access failures or empty content gracefully by surfacing an actionable error message and avoiding creation of empty documents.
- **FR-007**: System SHOULD retain undo/redo history such that the initial clipboard insertion can be undone like any other document creation.
- **FR-008**: System SHOULD log the creation event for diagnostic purposes consistent with existing action logging.

### Key Entities *(include if feature involves data)*

- **Document Node**: Represents a file in the workspace tree. Attributes include unique identifier, parent folder, inferred document type, initial content (clipboard text), timestamps, and metadata for syntax highlighting.
- **Clipboard Payload**: Temporary representation of data fetched from the OS clipboard containing mime type, text content, and detection metadata.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a clipboard-based document in ≤2 interactions (invoke command + confirm) without manual paste.
- **SC-002**: Document type detection succeeds for ≥90% of supported textual formats used in acceptance testing (Markdown, JSON, code files, plain text).
- **SC-003**: Feature prevents creation of empty documents when clipboard is empty in 100% of tested scenarios.
- **SC-004**: No critical errors or crashes are observed in telemetry/logs after 50 automated or manual invocations across Windows, macOS, and Linux builds.
