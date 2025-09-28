# DocForge

DocForge is a desktop application designed to streamline the process of creating, managing, and refining documents for Large Language Models (LLMs). It connects to local AI providers like Ollama, allowing you to leverage the power of AI to improve your documents in a secure, offline-first environment.

![DocForge Screenshot](https://raw.githubusercontent.com/TimSirmov/prompt-forge/main/assets/screenshot.png)

## Key Features

- **Modern, Draggable Title Bar:** A sleek, VS Code-style custom title bar maximizes screen space and integrates essential functions (Electron version only).
- **Integrated Command Palette:** Quickly access all core functions from a central search bar built directly into the title bar.
- **Hierarchical Document Organization:** Organize your documents and ideas in a familiar folder structure. Create nested subfolders, duplicate items, and use drag-and-drop to rearrange your workspace.
- **Full Keyboard Navigation:** Navigate the document and template sidebar using only the keyboard for a faster workflow.
- **Universal Monaco Editor:** A powerful, VS Code-like editor is used for all document types, including Markdown, HTML, and various source code files, with syntax highlighting and code folding.
- **Multi-Format Live Preview:** Get a real-time, rendered preview for multiple document types (including Markdown and HTML). The preview can be displayed side-by-side (vertically or horizontally) with the editor.
- **AI-Powered Refinement:** Use your connected local LLM to automatically refine and improve your documents with a single click.
- **Document Templating:** Create reusable document templates with variables to quickly generate new documents for recurring tasks.
- **Version History:** Explicitly save new versions of your documents with a dedicated button. Manage your history by viewing diffs, deleting old versions, and restoring to any point in time.
- **Local LLM Discovery:** Automatically detects running local LLM providers like Ollama and LM Studio for easy setup.
- **Customizable Interface:** Switch between light and dark themes, adjust the UI scale, and choose from multiple icon sets to personalize your experience.
- **Comprehensive Action Logging**: Every user action is logged, providing a clear audit trail and making debugging easier.
- **Offline First:** All your data is stored locally on your machine.
- **Compressed Backups**: Database backups are compressed with Gzip to significantly reduce file size.
- **Auto-Update:** The application can automatically check for and install updates (pre-release versions are opt-in).
- **Resizable Layout:** The sidebar, templates panel, and logger panel are all fully resizable to customize your workspace.

## Getting Started

1.  **Download:** Grab the latest release for your operating system from the [Releases](https://github.com/TimSirmov/prompt-forge/releases) page.
2.  **Run a Local LLM:** Ensure you have a local AI provider like [Ollama](https://ollama.ai/) or [LM Studio](https://lmstudio.ai/) running.
3.  **Configure:** Launch DocForge, open the Settings view, and select your detected LLM service and a model to use for refinement tasks.
4.  **Create:** Start creating, organizing, and refining your documents!

For detailed instructions on usage and features, please refer to the [Functional Manual](./FUNCTIONAL_MANUAL.md).