# Version Log

## v0.6.9 - The Release Prep Maintenance

### 🐛 Fixes

-   Updated the release workflow fixtures to validate the `v0.6.9` tag and installers, keeping the automated publishing checks aligned with the shipped binaries.

### 📝 Documentation

-   Refreshed the release preparation guides so every README and manual references the `v0.6.9` tagging flow and synchronized documentation updates.

## Unreleased - The Document Export Primer

### ✨ New

-   Added a Save to File action throughout the document tree and command palette so any document can be exported with a context-aware filename and extension.

### 📝 Documentation

-   Documented the export workflow across the README and manuals, including technical notes about the new `documentExportService` and how the Electron bridge streams files to disk.

## v0.6.8 - The Shortcut & Clipboard Update

### ✨ Features

-   Added a **New from Clipboard** action that classifies the pasted content,
    chooses the correct language mode, and drops the result directly into the
    selected folder or overview toolbar for rapid capture of external notes.
-   Expanded the keyboard shortcut editor to cover document tree commands such
    as rename, copy, and clipboard-driven creation, and introduced a clear
    button so bindings can be reset without editing JSON by hand.
-   Extended syntax support with dedicated PlantUML highlighting and TOML
    language detection, keeping previews and the Monaco editor in sync for
    infrastructure-as-code files and diagram sources.

### 🐛 Fixes

-   Restored reliable focus handling after dialogs and creation modals so
    keyboard-driven workflows resume in the document tree without manual
    clicks.
-   Enabled shift-based range selection and improved status bar messaging,
    making large sidebar edits clearer and keyboard-friendly.
-   Tightened Markdown preview spacing and blank-line preservation to match the
    rendered output across divider, code block, and prose layouts.
-   Hardened Windows auto-update manifests so renamed installers still publish
    valid metadata and the updater never stalls on checksum verification.

### 🛠 Infrastructure

-   Added regression coverage and logging around release manifest generation to
    catch duplicate uploads or mismatched digests before shipping builds.
-   Integrated GitHub Spec Kit workflows and refreshed assets so future changes
    arrive with automated specification checks.

> TODO: Document how to clear or reset keyboard shortcuts in the Functional
> Manual's settings chapter.
> TODO: Call out PlantUML and TOML syntax coverage in the published manuals so
> users can discover the new language support.

## v0.6.7 - The Auto-Update Reliability Pass

### ✨ Features

-   Verified update metadata before downloads so the in-app updater refuses
    corrupted releases and surfaces actionable status messages instead of
    silent failures.

### 🐛 Fixes

-   Repaired checksum selection logic and prevented duplicate manifest uploads,
    eliminating the checksum mismatch loop affecting Windows users.
-   Ignored unpacked app directories and tightened manifest naming, keeping the
    published feed aligned with the installers actually shipped.

### 🛠 Infrastructure

-   Added regression tests for remote auto-update flows and release metadata to
    guard against future publishing regressions.

## v0.6.6 - The Update Controls Release

### ✨ Features

-   Added manual update controls in Settings so administrators can disable
    background downloads or opt into pre-release builds on their schedule.
-   Introduced a progressive auto-update toast that surfaces download progress,
    installation status, and restart prompts inside the app.

### 🐛 Fixes

-   Resolved GitHub tag lookup, feed parsing, and digest validation regressions
    so update checks succeed across every supported platform.
-   Removed unused elevation helpers from release bundles, shrinking Windows
    installers and avoiding antivirus prompts.

### 🛠 Infrastructure

-   Rebuilt the GitHub Actions release workflows to create tags, upload
    manifests, and publish installers automatically once a version is pushed.

> TODO: Extend the manuals with guidance for the new manual update controls and
> notification toasts.

## v0.6.5 - The Settings & Workspace Upgrade

### ✨ Features

-   Reorganized the Settings view into focused categories and added JSON
    import/export so configurations can be shared between machines.
-   Enabled bootstrapping brand new workspace databases from the UI, letting
    teams spin up fresh environments without touching the filesystem.
-   Added a configurable active-line highlight for the editor to improve focus
    in dark themes and high-contrast setups.

### 🐛 Fixes

-   Restored `Ctrl+Shift+P` access to the command palette inside Monaco so
    keyboard users can launch commands without leaving the editor.
-   Fixed Markdown preview zoom overflow and ensured restored documents scroll
    into view, smoothing everyday navigation across large notebooks.

### 🛠 Infrastructure

-   Shipped cross-platform build workflows that package macOS, Windows, and
    Linux installers on every release and attach them to GitHub automatically.
-   Bundled the PlantUML runtime with desktop builds and improved offline
    renderer error reporting to support fully offline diagram previews.

> TODO: Document the active-line highlight preference in the Settings reference
> and note that new workspaces can be created directly from the UI.

## v0.6.4 - The Workspace Mobility Update

### ✨ Features

-   Let users choose custom database locations and surface the active workspace
    path in the status bar for quick auditing of production versus sandbox
    files.
-   Enabled copying documents across workspaces via drag-and-drop, making it
    easy to reuse content between projects without exporting archives.
-   Added a one-click **Format** button to the editor toolbar so Markdown, JSON,
    and script files stay tidy.

### 🐛 Fixes

-   Resolved cross-workspace drag-and-drop edge cases and ensured imported
    nodes land exactly where they were dropped.
-   Corrected folder overview navigation and search result selection so the
    summary view always opens the intended document.

### 🛠 Infrastructure

-   Updated documentation and status bar tooltips to reflect the new database
    controls and workspace visibility details.

> TODO: Describe cross-workspace drag-and-drop behavior in the Functional
> Manual so multi-database teams know it exists.

## v0.6.3 - The Workspace Navigation Update

### ✨ Features

-   Introduced document tab management with overflow navigation controls,
    keeping frequently edited files within reach even on narrow displays.
-   Expanded the Folder Overview with activity summaries, scoped search, and
    inline rename so teams can triage large directories without diving into the
    tree.
-   Added standalone PlantUML previews and an offline rendering mode for
    diagrams, eliminating the dependency on external services when a local JRE
    is available.

### 🐛 Fixes

-   Fixed a regression that left the Monaco editor blank after launch by
    ensuring initialization completes before mounting the view.

### 🛠 Infrastructure

-   Added an `npm run dev` alias and related build tweaks to streamline local
    development during the tab overhaul.

> TODO: Capture document tab overflow controls in the manuals so users discover
> the new navigation affordances.

## v0.6.2 - The Preview & Personalization Release

### ✨ Features

-   Added PDF and common image previews with dedicated renderers so binary
    assets open directly inside DocForge.
-   Enhanced sidebar search with full-text snippets, highlighting matches in
    context to speed up content discovery.
-   Introduced editor font/background settings and adjustable document tree
    spacing so the workspace can be tuned to different accessibility needs.

### 🐛 Fixes

-   Preserved binary payloads during PDF imports and repaired the drop overlay
    that lingered after file uploads.
-   Tightened Markdown spacing and syntax highlighting so rendered previews
    match the source even in fenced code blocks.

### 🛠 Infrastructure

-   Swapped the application icon pipeline to build from the canonical SVG and
    corrected the GitHub publishing target, keeping release assets consistent.

> TODO: Document the editor font/background controls and tree spacing options
> in the customization sections of the manuals.

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