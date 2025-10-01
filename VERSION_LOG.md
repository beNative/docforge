# Version Log

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