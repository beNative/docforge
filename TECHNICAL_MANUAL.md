# DocForge Technical Manual

This document provides a technical overview of the DocForge application's architecture, components, and key systems.

## Table of Contents

1.  [Technology Stack](#technology-stack)
2.  [Project Structure](#project-structure)
3.  [Application Architecture](#application-architecture)
    -   [Electron Main Process](#electron-main-process)
    -   [Renderer Process (React)](#renderer-process-react)
    -   [State Management](#state-management)
4.  [Key Systems](#key-systems)
    -   [Database & Repository Service](#database--repository-service)
    -   [LLM Service](#llm-service)
    -   [Component Breakdown](#component-breakdown)

---

## 1. Technology Stack

-   **Framework:** [Electron](https://www.electronjs.org/) for cross-platform desktop application development.
-   **UI Library:** [React](https://reactjs.org/) for building the user interface.
-   **Language:** [TypeScript](https://www.typescriptlang.org/) for type safety and improved developer experience.
-   **Database:** [SQLite](https://www.sqlite.org/index.html) via the [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) library for robust, local data storage.
-   **Bundler:** [esbuild](https://esbuild.github.io/) for fast and efficient bundling of the application's source code.
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) for a utility-first CSS framework.
-   **Packaging:** [electron-builder](https://www.electron.build/) for creating distributable application packages.

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

### LLM Service (`services/llmService.ts`)

This module handles all communication with the external Large Language Model. It is largely unchanged by the database migration.
-   It constructs the appropriate API request body based on the configured API type (Ollama or OpenAI-compatible).
-   It includes robust error handling to manage connection failures or non-OK responses from the provider.

### Component Breakdown

-   **`App.tsx`:** The root component that orchestrates the entire application. It initializes the repository, triggers the data migration if needed, manages the main layout, and uses the data hooks (`useNodes`, `useSettings`, etc.).
-   **`Sidebar.tsx`:** Manages the display of the `nodes` tree (documents and folders) and templates. It handles search/filtering, drag-and-drop, and keyboard navigation.
-   **`DocumentEditor.tsx`:** The main editor. It now receives a `Node` object. When content is saved, it communicates with the repository to hash the content, create a new version, and update the database, leveraging the content-addressable storage system.
-   **`SettingsView.tsx`:** Manages all application settings, which are now read from and saved to the `settings` table in the database.
-   **`DocumentHistoryView.tsx`:** This view now fetches version history for a document directly from the database, providing a reliable timeline of changes.