# DocForge

DocForge is a desktop application designed to streamline the process of creating, managing, and refining documents for Large Language Models (LLMs). It connects to local AI providers like Ollama, allowing you to leverage the power of AI to improve your documents in a secure, offline-first environment.

![DocForge Screenshot](https://raw.githubusercontent.com/beNative/docforge/main/assets/screenshot.png)

## Key Features

- **Modern, Draggable Title Bar:** A sleek, VS Code-style custom title bar maximizes screen space and integrates essential functions (Electron version only).
- **Integrated Command Palette:** Quickly access all core functions from a central search bar.
- **Hierarchical Document Organization:** Organize your documents in a familiar folder structure. Create nested subfolders, duplicate items, and use drag-and-drop to rearrange your workspace or import files from your computer.
- **Full Context Menu & Keyboard Navigation:** Navigate and manage items using a complete right-click context menu or use only the keyboard for a faster workflow.
- **Universal Monaco Editor:** A powerful, VS Code-like editor is used for all document types, including Markdown, HTML, and various source code files, with syntax highlighting and code folding.
- **Multi-Format Live Preview:** Get a real-time, rendered preview for multiple document types (including Markdown and HTML). The preview can be displayed side-by-side (vertically or horizontally) with the editor.
- **AI-Powered Refinement:** Use your connected local LLM to automatically refine and improve your documents with a single click.
- **Document Templating:** Create reusable document templates with variables to quickly generate new documents for recurring tasks.
- **Integrated Python Workflow:** Open an inline Python console tied to your documents to execute snippets, review logs, and manage isolated environments without leaving DocForge.
- **Shell & PowerShell Execution:** Run or syntax-test scripts directly from the editor with per-document environment overrides that merge with workspace defaults configured in Settings.
- **Version History:** Explicitly save new versions of your documents. Manage your history by viewing diffs, deleting old versions, and restoring to any point in time.
- **Local LLM Discovery:** Automatically detects running local LLM providers like Ollama and LM Studio for easy setup.
- **Highly Customizable:**
    - **Interface:** Switch between light and dark themes, adjust the UI scale, and choose from multiple icon sets.
    - **Keyboard Shortcuts:** Remap default shortcuts for core application commands to fit your preferences.
- **Database Management:** A dedicated settings panel allows you to view database statistics, run integrity checks, and perform maintenance like backups and optimization.
- **Workspace Bootstrap:** Create a brand new SQLite database from the status bar or settings to start fresh without leaving the app.
- **Configurable Data Storage:** Choose a custom SQLite database location or reopen an existing workspace file from the settings panel.
- **Comprehensive Action Logging**: Every user action is logged, providing a clear audit trail and making debugging easier.
- **Offline First:** All your data is stored locally on your machine.
- **Auto-Update:** The application can automatically check for and install updates (pre-release versions are opt-in).
- **Resizable Layout:** The sidebar, templates panel, and logger panel are all fully resizable to customize your workspace.

## Getting Started

1.  **Download:** Grab the latest release for your operating system from the [Releases](https://github.com/beNative/docforge/releases) page.
2.  **Run a Local LLM:** Ensure you have a local AI provider like [Ollama](https://ollama.ai/) or [LM Studio](https://lmstudio.ai/) running.
3.  **Configure:** Launch DocForge, open the Settings view, and select your detected LLM service and a model to use for refinement tasks.
4.  **Create:** Start creating, organizing, and refining your documents!

For detailed instructions on usage and features, please refer to the [Functional Manual](./FUNCTIONAL_MANUAL.md).
To review the history of changes, see the [Version Log](./VERSION_LOG.md).

## Spec-Driven Development Workflow

DocForge adopts [GitHub Spec Kit](https://github.com/github/spec-kit) to keep feature planning, implementation, and review aligned. The toolkit installs slash commands for AI coding assistants and project scripts that generate numbered spec packages under [`specs/`](../specs/README.md).

### Install the Specify CLI

Use the [`uv`](https://github.com/astral-sh/uv) tool to install or upgrade the Spec Kit CLI globally:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
# Upgrade later with:
uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git
```

Run `specify check` inside the repository to confirm prerequisites.

### Create a Feature Specification

1. Generate a scaffolded spec folder and branch slug:
   ```bash
   .specify/scripts/bash/create-new-feature.sh "<feature summary>"
   ```
2. Use your preferred AI assistant with the `/speckit.*` commands to fill out the artifacts:

   **Core commands**

   - `/speckit.constitution` updates the governance document.
   - `/speckit.specify`, `/speckit.plan`, and `/speckit.tasks` populate the feature spec, technical plan, and task list.
   - `/speckit.implement` can translate an approved plan into code.

   **Optional commands**

   - `/speckit.clarify` resolves ambiguous requirements before planning.
   - `/speckit.analyze` checks alignment across spec, plan, and tasks prior to implementation.
   - `/speckit.checklist` generates quality checklists tailored to the feature.
3. Commit the spec folder before beginning implementation so reviewers can trace scope and acceptance criteria.

## Release Preparation

To create a new public build of DocForge:

1. Update the version in `package.json` and regenerate the lockfile with `npm version <new-version> --no-git-tag-version`.
2. Draft the release notes by updating `VERSION_LOG.md` with a new section that summarizes the changes included in the release (the automated workflow copies the top entry into the GitHub release body).
3. Review the Markdown documentation (README, manuals, and release notes) so the written guidance matches the current workflow.
4. Sync the documentation copies under `docs/` (README, manuals, version log) with any updates made at the project root.
5. Commit the changes and push them to the default branch so the release tag points at the finalized documentation.
6. Create and push a tag that matches the new version (for example, `git tag v0.6.8` followed by `git push origin v0.6.8`) to trigger the automated release workflow.
7. Monitor the "Release" workflow run, then confirm that the published GitHub release lists the correct notes and includes installers for every platform before announcing availability.

## Application Icon Workflow

- The canonical artwork lives at `assets/icon.svg`. Keep this SVG under version control to simplify brand updates.
- `npm run build` (and any script that calls it) automatically validates the SVG and regenerates `icon.icns`, `icon.ico`, and a high-resolution `icon.png` via the `scripts/prepare-icons.mjs` helper.
- If the SVG is missing or invalid the script logs a warning and leaves existing binary icons untouched, allowing packaging to proceed with the previously generated assets.
- Run `npm run prepare:icons` to regenerate the platform-specific icons on demand without rebuilding the JavaScript bundles.

