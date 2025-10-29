# DocForge Technical Manual

This document provides a technical overview of the DocForge application's architecture, components, and key systems.

---

## 1. Technology Stack

-   **Framework:** [Electron](https://www.electronjs.org/) for cross-platform desktop application development.
-   **UI Library:** [React](https://reactjs.org/) for building the user interface.
-   **Language:** [TypeScript](https://www.typescriptlang.org/) for type safety and improved developer experience.
-   **Editor Core:** [Monaco Editor](https://microsoft.github.io/monaco-editor/) for a rich, consistent editing experience.
-   **Database:** [SQLite](https://www.sqlite.org/index.html) via the [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) library for robust, local data storage.
-   **Bundler:** [esbuild](https://esbuild.github.io/) for fast and efficient bundling of the application's source code.
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) for a utility-first CSS framework.
-   **Packaging:** [electron-builder](https://www.electron.build/) for creating distributable application packages.
-   **Diagram Rendering:** [PlantUML](https://plantuml.com/) via either the public plantuml.com service or a PlantUML jar bundled with the application (`assets/plantuml/plantuml.jar`). Offline rendering invokes the jar through the system Java Runtime Environment, so diagrams render without any network connectivity.

---

## 2. Project Structure

```
doc-forge/
├── assets/               # Static assets like the application icon.
├── components/           # Reusable React components.
│   ├── iconsets/         # SVG icon components for different libraries.
│   └── ...
├── contexts/             # React context providers for global state.
├── electron/             # Source code for the Electron main process.
│   ├── database.ts       # Manages the SQLite database connection and migrations.
│   ├── schema.ts         # Contains the embedded SQL schema string.
│   ├── main.ts           # Main process entry point.
│   └── preload.ts        # Preload script for secure IPC.
├── hooks/                # Custom React hooks for business logic.
├── services/             # Modules for data access and external systems.
│   ├── preview/          # Renderer plugins for the preview system.
│   └── ...
├── release/              # Output directory for packaged application.
├── dist/                 # Output directory for bundled code.
├── index.html            # The main HTML file for the renderer process.
├── index.tsx             # The entry point for the React application.
├── package.json          # Project metadata and dependencies.
└── ...
```

---

## 3. Application Architecture

### Electron Main Process (`electron/`)

The main process is responsible for managing the application lifecycle, database, and native OS interactions.

-   **Window Management:** It creates the frameless `BrowserWindow` which contains the React UI.
-   **Database Management (`database.ts`):** This service is the single owner of the SQLite database file. It uses `better-sqlite3` to open the connection, run schema migrations on startup, and execute queries. All database access must go through this service.
-   **IPC (Inter-Process Communication):** It sets up IPC handlers to listen for events from the renderer process. The UI communicates with the database *exclusively* through these channels. Key handlers include:
    -   `db:query`, `db:run`: Generic handlers to execute SQL against the database.
    -   `db:duplicate-nodes`: A handler to perform a deep, transactional copy of selected nodes.
    -   `db:migrate-from-json`: A special handler for the one-time migration of data from old JSON files.
    -   Window Controls: Handlers for `window:minimize`, `window:maximize`, etc.
-   **Security:** The `preload.ts` script uses Electron's `contextBridge` to securely expose specific IPC functions to the renderer process under the `window.electronAPI` object, maintaining context isolation.

### Renderer Process (React)

The renderer process is responsible for the entire user interface.

-   **Component Tree:** The application is built as a tree of React components, starting from `index.tsx`.
-   **UI State:** Most UI state is managed within components using React hooks (`useState`, `useMemo`).
-   **Business & Data Logic:** Logic for managing the application's data is encapsulated in custom hooks (e.g., `useNodes`, `useTemplates`, `useSettings`). These hooks interact with the `repository.ts` service to communicate with the backend.

### State Management

-   **React Hooks & Context:** Global state (like theme and logs) is shared via React Context.
-   **SQLite Database:** The single source of truth for all persistent data (documents, folders, templates, settings, versions) is the `docforge.db` SQLite file. Data is fetched into React state on load and updated in the database via the repository service.

---

## 4. Key Systems

### Database & Repository Service

This is the core data persistence layer, replacing the old JSON file system.

-   **`electron/database.ts` (Main Process):** Manages the physical database file and connection using `better-sqlite3`. It handles schema creation and versioning by executing SQL scripts embedded directly within the application's source code (`electron/schema.ts`). This removes the need for external `.sql` files and simplifies packaging.
-   **`services/repository.ts` (Renderer Process):** The data access layer for the UI. It acts as an abstraction over the IPC communication. It contains all the application's SQL queries and provides clear, async methods (e.g., `getNodeTree()`, `updateDocumentContent()`, `deleteDocVersions()`, `duplicateNodes()`) for the React hooks to use. It does *not* access the database directly.
-   **Schema:** The database uses a highly normalized schema with tables for `nodes` (hierarchy), `documents`, `content_store` (for content-addressable storage and deduplication), and `doc_versions`.
-   **One-Time Migration:** The repository contains logic to detect if it's the first run with the new database. If old JSON files are found, it reads them and sends the data to the main process to be migrated into the SQLite database in a single, safe transaction.

### Universal Editor & Preview System

This system provides a consistent and extensible editing experience for all document types. It is built on a decoupled, modular architecture.

-   **`CodeEditor.tsx`:** A React component that wraps and configures the Monaco Editor instance. It's responsible for managing the editor's content, theme, and language for syntax highlighting based on props.
-   **`PreviewPane.tsx`:** This component is responsible for displaying the rendered output of a document. It debounces content updates for performance and uses the `PreviewService` to get the correct output.
-   **`services/previewService.ts`:** This service acts as a registry for all available renderer "plugins." It exposes a method, `getRendererForLanguage()`, which finds and returns the appropriate renderer for a given language ID (e.g., 'markdown').
-   **Renderer Plugins (`services/preview/`):** Each file format with a preview is supported by a dedicated renderer class that implements the `IRenderer` interface. This makes the system highly extensible: to support a new format, one only needs to create a new renderer class and add it to the `previewService` registry. The bundled plugins cover Markdown (with Mermaid + PlantUML support), standalone PlantUML documents, HTML, PDFs, common image formats, and a plaintext fallback renderer.
    -   Both the Markdown renderer and the standalone PlantUML renderer share the `PlantUMLDiagram` component, which routes diagrams through either the remote plantuml.com server or the offline Java-based IPC bridge depending on the active setting.

### Document Export Service (`services/documentExportService.ts`)

The export service centralizes all logic for saving documents to disk.

-   **Extension Inference:** It inspects the document's type, Monaco language hint, and any embedded MIME metadata to choose the best file extension. Titles are sanitized and de-duplicated so the suggested filename is always valid.
-   **Payload Preparation:** Text documents are serialized with UTF-8 defaults, while PDFs and images are decoded from data URLs or base64 strings into `Uint8Array` buffers before saving.
-   **Renderer Integration:** Renderer components call `handleSaveNodeToFile()` which delegates to the export service. In Electron builds the payload is sent over IPC to `electron/main.ts`, which opens a native save dialog and streams the bytes. Browser builds fall back to programmatically triggering a download with the correct MIME type.
-   **Cancellation Handling:** If a user dismisses the save dialog, the service returns a `canceled` result that callers treat as a no-op so logs and notifications stay quiet.
### Script Execution Pipeline

DocForge treats shell and PowerShell automation as first-class workflows that span the renderer and main processes.

-   **Renderer orchestration (`components/ScriptExecutionPanel.tsx`):** Presents the UI for configuring per-document environment variables, working directory, and interpreter overrides. It merges those overrides with the defaults loaded from the settings context before dispatching a run.
-   **IPC bridge (`services/scriptService.ts`):** Normalizes renderer requests into `scriptRun`, `scriptGetNodeSettings`, and related IPC calls. In preview builds it can swap to the mock bridge exposed by `preview/createScriptPreviewBridge.ts` so web previews behave consistently.
-   **Main-process runner (`electron/scriptRunner.ts`):** Persists run metadata, writes temporary script files, and spawns the resolved executable. Test mode leverages `scriptArgs.ts` to compute syntax-only flags (for example, Bash `-n`, or a PowerShell `ScriptBlock` parser) and gracefully fails when an interpreter cannot support syntax checks. Streams from stdout/stderr are recorded to `script_execution_logs` and broadcast back to the renderer.
-   **Defaults management:** Global defaults live in the `settings` table (`shellDefaults`, `powershellDefaults`) and are edited through `SettingsView.tsx`. When a run starts, the runner merges these defaults with per-document overrides so teams can set organization-wide variables while allowing individual scripts to customize their environment safely.

### LLM Service (`services/llmService.ts`)

This module handles all communication with the external Large Language Model. It is largely unchanged by the database migration.
-   It constructs the appropriate API request body based on the configured API type (Ollama or OpenAI-compatible).
-   It includes robust error handling to manage connection failures or non-OK responses from the provider.

### Component Breakdown

-   **`App.tsx`:** The root component that orchestrates the entire application. It initializes the repository, triggers the data migration if needed, manages the main layout, and uses the data hooks (`useNodes`, `useSettings`, etc.).
-   **`Sidebar.tsx`:** Manages the display of the `nodes` tree (documents and folders) and templates. It handles search/filtering, drag-and-drop, and keyboard navigation.
-   **`DocumentEditor.tsx`:** The primary user-facing editor component. It serves as a layout controller, managing the view mode (editor, preview, split-screen) and containing both the `CodeEditor` (Monaco) and `PreviewPane` components. It orchestrates the flow of data between the editor and the preview.
-   **`SettingsView.tsx`:** Manages all application settings, which are now read from and saved to the `settings` table in the database.
-   **`DocumentHistoryView.tsx`:** This view now fetches version history for a document directly from the database, providing a reliable timeline of changes.

---

## 5. Build & Release Workflow

Electron Builder manages the packaging and publishing workflow for DocForge. The most relevant npm scripts are:

-   `npm run build` — Bundles the renderer and preload scripts, prepares assets in `dist/`, and generates platform icon binaries from the source SVG.
-   `npm run package` — Produces distributable builds without uploading them.
-   `npm run publish` — Builds the application and publishes artifacts using Electron Builder's configured GitHub target.

### Publishing a Release

1. Run `npm version <new-version> --no-git-tag-version` to bump the version in both `package.json` and `package-lock.json` without creating a Git tag.
2. Update `VERSION_LOG.md` with a new section that captures the highlights of the release—the automated workflow copies the top entry into the GitHub release body.
3. Review and update the Markdown documentation (README, manuals, release notes) so the written guidance reflects the final state of the build.
4. Sync the Markdown files under `docs/` with the copies at the project root.
5. Commit and push the changes so the release tag points at the finished documentation.
6. Create and push a matching version tag (for example, `git tag v0.6.8` followed by `git push origin v0.6.8`) to trigger the automated release pipeline.
7. Monitor the "Release" workflow run and verify the published GitHub release lists the correct notes and includes the installers for every supported platform before announcing availability.

### Automated Release Workflow

-   Tag pushes that match `v*` trigger the `Release` GitHub Actions workflow.
-   An initial job extracts the latest section from `VERSION_LOG.md` and creates the GitHub release with those notes.
-   A platform matrix rebuilds DocForge via the existing packaging scripts (`npm run package:*`) for macOS, Windows (x64/ia32), and Linux (x64/arm64/armv7l).
-   Each job uploads its generated installers (and accompanying update manifests) to the release using the GitHub CLI.
-   `npm run publish` remains available for manual distribution, but the automated workflow is the canonical path for tagged releases.

### Application Icon Pipeline

-   The canonical icon artwork lives at `assets/icon.svg`. During `npm run build` (and thus during `npm run package`/`npm run publish`), the `scripts/prepare-icons.mjs` script validates the SVG and, if valid, generates the required `icon.icns`, `icon.ico`, and `icon.png` files in the `assets/` directory using `icon-gen`.
-   If the SVG is missing or invalid, the script logs a warning and leaves the existing binary icon assets untouched so packaging can proceed with the previous icons.
-   To regenerate icons without running a full build, execute `npm run prepare:icons`.

---

## 6. Spec-Driven Development Assets

DocForge integrates GitHub Spec Kit to manage feature planning artifacts alongside the codebase.

-   **CLI tooling:** Install the Specify CLI with `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git` and run `specify check` to validate prerequisites.
-   **Project scripts:** Helper scripts live under `.specify/scripts/` for creating feature folders, updating agent context, and enforcing executable permissions.
-   **Spec storage:** Feature specifications, plans, and task lists reside in numbered folders under `specs/`. See [`specs/README.md`](../specs/README.md) for the canonical workflow.
-   **Agent prompts:** Slash-command prompt files for AI assistants are stored in `.github/prompts/`, enabling `/speckit.*` commands inside supported tools.
-   **Governance:** The living constitution at `.specify/memory/constitution.md` defines development principles, quality gates, and review expectations for the project.
