# Feature Specification: Auto-detect document language when nodes are created from external content

**Feature Branch**: `[001-auto-detect-node]`
**Created**: 2024-05-07
**Status**: Draft
**Input**: User description: "Make the application guess the file type automatically on drag and dropping nodes and on copy pasting text into a new node "

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Paste clipboard text into a new node (Priority: P1)

When I copy source text from another tool and paste it into DocForge as a brand-new document, the app should infer a sensible language hint so syntax highlighting and default preview mode are correct without extra clicks.

**Why this priority**: Clipboard-to-node is the fastest way to seed content and currently defaults to Markdown, which breaks editing flows for code or data files.

**Independent Test**: Paste different language snippets into a fresh node created via the "Paste as Document" action and verify the detected language and doc type matches expectations without any manual adjustment.

**Acceptance Scenarios**:

1. **Given** an empty workspace and TypeScript code copied to the clipboard, **When** I invoke "Paste as Document" in the tree, **Then** DocForge creates a document marked as `source_code` with language hint `typescript` and opens it in the editor.
2. **Given** JSON copied to the clipboard, **When** I paste it as a new document, **Then** the document language hint is `json`, the doc type is `source_code`, and the preview defaults to the editor (not Markdown preview).
3. **Given** Markdown text copied to the clipboard, **When** I paste it as a new document, **Then** the language hint remains `markdown`, the doc type is `prompt`, and default view mode stays editable.

---

### User Story 2 - Drag & drop DocForge nodes without metadata (Priority: P2)

When I drag nodes exported from another DocForge workspace (or a JSON snippet of nodes) into my current tree, the app should infer their file types if the payload lacks explicit hints so they behave the same as the originals.

**Why this priority**: Imported nodes currently fall back to generic prompts, forcing manual fixes and ruining previews for PDFs, images, and code.

**Independent Test**: Drop serialized nodes whose `language_hint` fields are empty and confirm the resulting documents get the correct doc type, preview mode, and syntax highlighting.

**Acceptance Scenarios**:

1. **Given** a dragged node titled `analysis.py` with Python code but no language metadata, **When** I drop it into the tree, **Then** the created document has doc type `source_code`, language hint `python`, and opens in the editor.
2. **Given** a node titled `diagram.puml` containing PlantUML text, **When** I drop it into a folder, **Then** the new document has language hint `plantuml` and default split preview enabled as per heuristics.
3. **Given** a dropped node representing an SVG diagram whose content starts with `<svg`, **When** I import it, **Then** the system tags it as an `image` doc type with preview default.

---

### User Story 3 - Preserve manual overrides (Priority: P3)

After the system guesses a language hint automatically, I want to be able to change it manually and have the app respect my choice.

**Why this priority**: Automated guesses are fallible; users must stay in control when heuristics misclassify.

**Independent Test**: Override the language hint on an auto-detected document and confirm the system stops re-guessing unless the user requests it explicitly.

**Acceptance Scenarios**:

1. **Given** a document auto-detected as JSON, **When** I manually change its language to YAML, **Then** the language remains YAML even after moving or re-opening the document.
2. **Given** a PlantUML file reclassified to Markdown by the user, **When** I drop more nodes afterwards, **Then** only the new nodes are guessed and the existing override is untouched.

### Edge Cases

- Clipboard text with mixed languages (e.g., Markdown containing fenced code blocks) should default to Markdown but highlight the need for manual override.
- Binary clipboard payloads or unsupported MIME types fall back to plaintext with a warning in the activity log.
- Extremely short snippets (under 20 characters) should default to Markdown/plaintext to avoid misclassification from sparse data.
- Dropped nodes whose titles lack extensions rely on content heuristics (shebangs, JSON braces, XML tags) before defaulting to Markdown.
- If heuristics confidently identify PDFs or images via data URLs, ensure binary content is preserved and stored in the blob-friendly path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When creating a document from clipboard content, the system MUST run a language detection heuristic (extensions in pasted filename metadata, content pattern matching, shebang detection) and set both `doc_type` and `language_hint` before saving the node.
- **FR-002**: The import workflow for `DraggedNodeTransfer` payloads MUST infer `doc_type`, `language_hint`, and default view mode when those values are missing or null, using title extensions and content sampling similar to file imports.
- **FR-003**: Heuristics MUST recognize at minimum Markdown, JSON, YAML, HTML, XML, common programming languages (JS/TS/Python/etc.), PlantUML, PDF (data URI), and common image formats.
- **FR-004**: Detected classifications MUST be surfaced to the user (activity log entry and document inspector) and allow manual override without re-triggering automatic guessing on subsequent edits.
- **FR-005**: When heuristics cannot determine a confident match, the system MUST fall back to the current default (`prompt`/`markdown`) and log that manual review is recommended.

### Key Entities *(include if feature involves data)*

- **Document Node**: Extends the existing node structure to store auto-detected `doc_type`, `language_hint`, and whether the values were set by heuristics or by the user.
- **Import Heuristic Result**: A lightweight object describing guessed language, confidence, source (extension, shebang, content pattern), and any warnings for telemetry/logging.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of documents created via clipboard paste across supported languages open with the correct syntax highlighting in manual QA testing (sample of at least 20 snippets).
- **SC-002**: 90% of DocForge node imports without metadata display the intended preview mode (editor vs. preview) without user intervention.
- **SC-003**: Activity logs clearly indicate classification results for 100% of auto-detected documents, enabling troubleshooting when guesses are incorrect.
- **SC-004**: Less than 5% of support tickets or user feedback items mention incorrect default language hints after release (tracked over the first month).
