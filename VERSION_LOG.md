# Version Log

## Unreleased - The Document Export Primer

### ✨ New

-   Added a Save to File action throughout the document tree and command palette so any document can be exported with a context-aware filename and extension.

### 📝 Documentation

-   Documented the export workflow across the README and manuals, including technical notes about the new `documentExportService` and how the Electron bridge streams files to disk.

## v0.6.8 - The Publication Polish Update

This maintenance release keeps the publication workflow accurate by bumping
the version metadata, refreshing the Markdown guides, and aligning the release
tests with the assets that will accompany the new tag.

### 🛠 Improvements

-   Bumped the application version to `v0.6.8` and refreshed the release
    tagging examples so the publishing checklist references the current
    commands.
-   Re-reviewed every Markdown guide (README, manuals, version log) and synced
    the copies in `docs/` to ensure the distributed documentation matches the
    repository source.
-   Summarized the release tasks in this log so the GitHub release body can be
    prepared directly from the latest entry.

### 🐛 Fixes

-   Updated the release workflow test fixtures to expect `v0.6.8`
    identifiers and artifact names, preventing mismatches once the new
    installer set is published.

## v0.6.7 - The Release Readiness Confirmation

This maintenance release double-checks the release process ahead of the next
build by updating the version metadata, aligning the release tests, and
resyncing the documentation bundle.

### 🛠 Improvements

-   Bumped the application version to `v0.6.7` and refreshed the release
    tagging examples so the workflow documentation continues to reflect the
    current command sequence.
-   Reverified every Markdown guide (README, manuals, version log) and synced
    the `docs/` copies to ensure the published documentation matches the
    repository sources.

### 🐛 Fixes

-   Updated the release workflow tests to expect the new versioned installer
    artifacts, preventing false failures when validating the publishing
    pipeline.

## v0.6.6 - The Documentation Assurance Update

This patch release keeps the publishing workflow aligned ahead of the next
build by refreshing the documentation set and confirming the release checklist
continues to match the automated pipeline.

### 🛠 Improvements

-   Bumped the application version to `v0.6.6` and refreshed the release
    tagging examples so contributors follow the current command sequence when
    preparing a build.
-   Revalidated every Markdown guide (README, manuals, version log) and synced
    the `docs/` copies to ensure the published documentation mirrors the
    repository sources.

### 🐛 Fixes

-   Replaced outdated tag references that still pointed to `v0.6.5`, avoiding
    confusion when publishing the release to GitHub.

## v0.6.5 - The Automated Release Update

This maintenance release introduces a hands-free publishing workflow so tagged
builds automatically land on GitHub with installers for every supported
platform.

### 🛠 Improvements

-   Added a GitHub Actions release pipeline that rebuilds the application for
    macOS, Windows (x64/ia32), and Linux (x64/arm64/armv7l) whenever a tagged
    version is pushed and attaches the generated installers to the release.
-   Refreshed the release preparation checklist across the documentation set to
    describe the tagging workflow and clarify how release notes flow from the
    version log into GitHub releases.
-   Synced all Markdown documentation so the published guides continue to match
    the repository sources.

### 🐛 Fixes

-   Removed stale guidance that referenced manually uploading binaries, keeping
    the publishing process consistent with the automated workflow.

## v0.6.4 - The Checklist Confidence Update

This maintenance release polishes the publishing checklist and documentation so
preparing the GitHub release is straightforward every time.

### 🛠 Improvements

-   Clarified the release preparation steps to call out copying the latest
    changelog entry into the GitHub release description after publishing.
-   Reconfirmed that every Markdown guide and its counterpart in `docs/` are in
    sync, ensuring the published documentation mirrors the repository sources.

### 🐛 Fixes

-   Tidied minor inconsistencies across the README and technical manual so the
    release workflow references match the expected commands and sequencing.

## v0.6.3 - The Release Readiness Refresh

This maintenance release aligns the publishing workflow documentation with the
latest release checklist so preparing builds remains predictable and
well-documented.

### 🛠 Improvements

-   Clarified the release preparation steps in the README and technical manual
    to include drafting release notes and syncing the published documentation
    bundle.
-   Ensured the `docs/` copies of the manuals stay in lockstep with the root
    documentation to avoid drift between the repository and published guides.

### 🐛 Fixes

-   Restored the missing release workflow section in the published technical
    manual so hosted documentation once again includes the full checklist.

## v0.6.2 - The Documentation Polish Update

This maintenance release focuses on keeping the documentation set in sync with the
project's release workflow so the publishing checklist is easy to follow.

### 🛠 Improvements

-   Synced the release preparation guidance between the project README and the
    documentation bundle to avoid diverging instructions.
-   Linked the README to the version history so maintainers can quickly review
    prior changes when drafting release notes.

### 🐛 Fixes

-   Corrected outdated documentation references that omitted the release
    preparation steps from the published docs bundle.

## v0.6.1 - The Release Prep Update

This maintenance release focuses on preparing DocForge for distribution by polishing the release workflow and tidying up the documentation set.

### 🛠 Improvements

-   Added an npm `publish` script so maintainers can build and upload releases with a single command.
-   Audited and refreshed the documentation set to ensure the README and manuals reflect the latest onboarding guidance.

### 🐛 Fixes

-   Addressed minor copy and formatting issues identified while reviewing the documentation for release.

## v0.6.0 - The Customization & Workflow Update

This release introduces powerful new ways to customize your workspace and streamline your workflow, including fully configurable keyboard shortcuts, an advanced settings editor, and enhanced file import capabilities.

### ✨ New Features & Major Improvements

-   **Customizable Keyboard Shortcuts**: A new "Keyboard Shortcuts" section has been added to the Settings view. Users can now view and customize the keyboard shortcuts for all major application commands to match their personal workflow.
-   **Advanced Settings Editor**: For power users, an "Advanced" settings tab is now available, offering both an interactive tree editor and a raw JSON editor for direct configuration of the application's settings.
-   **Direct Code File Creation**: A "New Code File" action has been added, allowing users to create new source code files by specifying a filename with an extension (e.g., `script.py`), which automatically sets the correct language for syntax highlighting.
-   **Enhanced File Import**: Users can now drag and drop files and folders directly into the application window or sidebar to import them. The application will intelligently preserve the folder structure of the dropped items.
-   **Database Management Tools**: The Settings view now includes a "Database" section with tools to view statistics, run an integrity check, create compressed backups, and optimize the database file (`VACUUM`).
-   **Full Context Menu**: The document and folder list now has a complete context menu (right-click) providing quick access to all common actions like creating, renaming, duplicating, and deleting items.

## v0.5.0 - The Universal Editor Update

This is a major feature release that replaces the simple Markdown editor with the powerful Monaco Editor (the core of VS Code) for all documents. It introduces a flexible, multi-format live preview system and makes Markdown the default for new documents.

### ✨ New Features & Major Improvements

-   **Universal Monaco Editor**: The editor has been upgraded to the Monaco Editor for all file types. This provides a consistent, professional-grade editing experience with syntax highlighting, code folding, and bracket matching for dozens of languages (e.g., Markdown, HTML, JS, Python).
-   **Multi-Format Live Preview**: The preview system is now modular and extensible. It supports live, rendered previews for both Markdown and HTML. The preview can be viewed in a vertical or horizontal split-screen layout.
-   **Language Selector**: A dropdown menu has been added to the editor toolbar, allowing users to manually change the language for syntax highlighting for any code file.
-   **Markdown by Default**: New documents created via the "New Document" button now default to the Markdown language type, enabling the live preview and rich text features immediately.

## v0.4.0 - The Logging & Stability Update

This release introduces comprehensive action logging, a redesigned logger panel, and significant improvements to the database backup feature.

### ✨ New Features & Major Improvements

-   **Comprehensive Action Logging**: Every user action—including button clicks, menu selections, and commands—is now logged to the Application Log. This provides a clear audit trail and makes debugging significantly easier.
-   **Integrated Logger Panel**: The logger panel has been redesigned to integrate seamlessly into the main window. When opened, it pushes the main content area up instead of overlapping it, ensuring all controls remain visible and accessible.
-   **Compressed Backups**: The database backup feature now uses Gzip compression, significantly reducing the size of backup files (saved with a `.db.gz` extension).

### 🐛 Bug Fixes

-   **Backup Functionality**: Fixed a critical bug that prevented the database backup feature from running correctly.

## v0.3.0 - The Layout Update

This release focuses on improving the sidebar layout and user interaction, making it more flexible and intuitive.

### ✨ New Features & Major Improvements

-   **Resizable Templates Panel:** The 'Templates' panel in the sidebar is now resizable. Users can drag the horizontal splitter to adjust the panel's height, providing more space for documents when needed.
-   **Streamlined UI:** The 'New from Template' button has been moved from the bottom of the sidebar to the 'Documents' header as a dedicated icon button. This creates a cleaner, more consistent, and always-visible access point for creating documents from templates.

## v0.2.0 - The Workflow Update

This version introduces significant workflow enhancements, giving users more explicit control over versioning and document organization.

### ✨ New Features & Major Improvements

-   **Manual Version Control:**
    -   **"Save Version" Button:** Replaced the automatic versioning system with a dedicated "Save Version" button in the editor. A new version is now created only when the user explicitly saves, preventing history clutter.
    -   **Version Deletion:** Users can now select and delete one or more old versions from the history view, providing full control over the document's timeline.
-   **Enhanced Node Management:**
    -   **New Subfolder:** A "New Subfolder" button has been added, allowing for the creation of nested folders directly within the selected folder.
    -   **Duplicate Selection:** A "Duplicate" button allows for the deep copying of one or more selected documents or folders, including all content and sub-items.
-   **UI & Terminology Polish:**
    -   **"Document" Terminology:** The application has been updated to use the term "document" instead of "prompt" throughout the UI and documentation, better reflecting its purpose.
    -   **Sticky Sidebar Toolbar:** The "Documents" action toolbar is now sticky, remaining visible and accessible when scrolling through a long list of items.

### 🐛 Bug Fixes

-   **Editor Stability:** Fixed a critical bug that made the editor unresponsive after a state management refactor.
-   **Node Reordering:** Corrected a bug where the "Move Up" button for a node in the sidebar did not work.
-   **AI Title Generation:** Fixed an issue where generating a title with AI would clear any unsaved text in the editor.
-   **Dialog Accessibility:** Confirmation dialogs (e.g., when deleting items) can now be confirmed by pressing the Enter key, improving keyboard workflow.

## v0.1.0 - Initial Release

This is the first public release of DocForge, a complete redesign and rebranding of the project. This version consolidates all previous features into a stable, modern, and efficient desktop application for managing and refining documents.

### ✨ Key Features

-   **Core Functionality:**
    -   **Hierarchical Document Organization:** Organize documents and ideas in a familiar folder structure with full drag-and-drop support (including multi-select).
    -   **AI-Powered Refinement & Titling:** Leverage a connected local LLM (like Ollama) to automatically refine document content and generate titles.
    -   **Document Templating:** Create reusable templates with `{{variables}}` to streamline the creation of new documents for recurring tasks.
    -   **Full Version History:** Every significant change to a document is saved. View a complete history, see visual diffs between versions, and restore to any point in time.
    -   **Robust Local Database:** All data is stored in a local SQLite database, ensuring fast, reliable, and offline-first access. The application can automatically migrate data from older file-based versions.

-   **Modern User Experience:**
    -   **Custom Title Bar & Command Palette:** A sleek, VS Code-style title bar integrates a powerful command palette (`Ctrl+Shift+P`) for quick access to all application functions.
    -   **Advanced Markdown Editor:** Write documents in Markdown with a live, side-by-side preview (vertical or horizontal split), syntax highlighting, and undo/redo support.
    -   **Full Keyboard Navigation:** Navigate the entire sidebar, including documents, folders, and templates, using only the keyboard.
    -   **Highly Customizable UI:**
        -   Switch between light and dark themes.
        -   Adjust the global UI scale to your preference.
        -   Choose from five different icon sets (Heroicons, Lucide, Feather, Tabler, Material).
    -   **Resizable Layout:** The sidebar and logger panels are fully resizable to customize your workspace.

-   **Application & System:**
    -   **Local LLM Discovery:** Automatically detects and connects to running local LLM services like Ollama and LM Studio for easy setup.
    -   **Auto-Update System:** The application checks for updates on startup and provides a simple way to install new versions. Includes an opt-in channel for pre-releases.
    -   **Integrated Tools:** Features a detailed logger panel for debugging, settings import/export, and comprehensive in-app documentation.