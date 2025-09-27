# DocForge

DocForge is a desktop application designed to streamline the process of creating, managing, and refining documents and prompts for Large Language Models (LLMs). It connects to local AI providers like Ollama, allowing you to leverage the power of AI to improve your prompts in a secure, offline-first environment.

![DocForge Screenshot](https://raw.githubusercontent.com/TimSirmov/prompt-forge/main/assets/screenshot.png)

## Key Features

- **Modern, Draggable Title Bar:** A sleek, VS Code-style custom title bar maximizes screen space and integrates essential functions (Electron version only).
- **Integrated Command Palette:** Quickly access all core functions from a central search bar built directly into the title bar.
- **Hierarchical Document Organization:** Organize your documents and ideas in a familiar folder structure. Use drag-and-drop to rearrange your workspace.
- **Full Keyboard Navigation:** Navigate the document and template sidebar using only the keyboard for a faster workflow.
- **AI-Powered Refinement:** Use your connected local LLM to automatically refine and improve your prompts with a single click.
- **Prompt Templating:** Create reusable prompt templates with variables to quickly generate new documents for recurring tasks.
- **Side-by-side Markdown Preview:** Write your documents in Markdown and see a live, rendered preview in real-time, either next to or below your editor.
- **Version History:** Automatically saves previous versions of your documents, allowing you to view diffs and restore to any point in time.
- **Local LLM Discovery:** Automatically detects running local LLM providers like Ollama and LM Studio for easy setup.
- **Customizable Interface:** Switch between light and dark themes, adjust the UI scale, and choose from multiple icon sets to personalize your experience.
- **Offline First:** All your data is stored locally on your machine.
- **Auto-Update:** The application can automatically check for and install updates (pre-release versions are opt-in).

## Getting Started

1.  **Download:** Grab the latest release for your operating system from the [Releases](https://github.com/TimSirmov/prompt-forge/releases) page.
2.  **Run a Local LLM:** Ensure you have a local AI provider like [Ollama](https://ollama.ai/) or [LM Studio](https://lmstudio.ai/) running.
3.  **Configure:** Launch DocForge, open the Settings view, and select your detected LLM service and a model to use for refinement tasks.
4.  **Create:** Start creating, organizing, and refining your documents!

For detailed instructions on usage and features, please refer to the [Functional Manual](./FUNCTIONAL_MANUAL.md).