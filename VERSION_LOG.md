# Version Log

## v0.1.0 - Initial Release

This is the first public release of DocForge, a complete redesign and rebranding of the project. This version consolidates all previous features into a stable, modern, and efficient desktop application for managing and refining LLM prompts.

### ✨ Key Features

-   **Core Functionality:**
    -   **Hierarchical Document Organization:** Organize documents and ideas in a familiar folder structure with full drag-and-drop support (including multi-select).
    -   **AI-Powered Refinement & Titling:** Leverage a connected local LLM (like Ollama) to automatically refine prompt content and generate titles.
    -   **Prompt Templating:** Create reusable templates with `{{variables}}` to streamline the creation of new documents for recurring tasks.
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