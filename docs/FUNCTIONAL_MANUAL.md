# DocForge Functional Manual

This manual provides a detailed overview of the features and functionality of the DocForge application.

---

## 1. The Main Window

The DocForge interface is designed to be clean and efficient, composed of four main sections.

### The Custom Title Bar

The top-most bar of the application provides global controls and information.

- **Application Title:** Displays the application name, "DocForge". The entire bar is draggable, allowing you to move the window.
- **Command Palette Search:** The central search box is your primary way to access the **Command Palette**. Clicking it or using the `Ctrl+Shift+P` shortcut opens a dropdown list of all available actions.
- **Global Actions (Right Side):**
    - **Info:** Toggles the Info View, where you can read application documentation.
    - **Logs:** Toggles the Logger Panel at the bottom of the screen.
    - **Theme Toggle:** Switches the application between light and dark modes.
    - **Settings:** Toggles the Settings View.
- **Window Controls:** Standard operating system controls to minimize, maximize/restore, and close the application.

### The Sidebar

The resizable left panel is your main navigation and organization area.

- **Search:** A search bar at the top lets you filter your documents and folders. It instantly checks titles while also running a background full-text search across document bodies, returning contextual snippets with the matched terms highlighted so you can quickly confirm relevance.
- **Documents List:** A hierarchical tree view of all your documents and folders.
    - **Action Toolbar:** A toolbar at the top of the list provides icon buttons to quickly create a new document, create a new root folder, create a new document from a template, expand/collapse all folders, and toggle the active document's lock state.
    - **Row Quick Actions:** Hover or focus any row to reveal a compact strip of icons for frequent tasks—duplicate, export, rename, lock/unlock (for editable repositories), and more. The controls float on the right edge so the row height stays consistent and labels retain their full width.
    - **Folders:** Can be expanded or collapsed.
    - **Documents:** Individual document files. Selecting a document opens it in the Main Content Area.
- **Templates List:** A separate panel below your documents for managing reusable templates. This panel is resizable; you can drag its top border to adjust its height.
    - **Action Toolbar:** The templates panel has its own toolbar for creating new templates.

The entire list of documents and templates can be navigated using your keyboard's arrow keys. Use `Up`/`Down` to move between items, `Right` to expand a folder, `Left` to collapse a folder (or move to its parent), and `Enter` to open the selected item. Alternatively, right-clicking on an item or in the empty space of the sidebar will open a context menu with common actions.

### The Main Content Area

This is the largest part of the application and displays the active content.

- **Document Tab Strip:** Opened documents appear in a horizontal strip above the editor. Tabs show the document title, file
  type badge, and an unsaved indicator so you can tell which files still need to be saved. Drag a tab to reorder it or tear it
  away into a separate window when multi-window mode is available.
- **Context Menu Actions:** Right-clicking a tab reveals commands to close the current document, close all other tabs, close
  the tabs to the right, duplicate the document into a new tab, or pin the tab so it always stays visible.
- **Overflow Picker:** When there are more tabs than can fit, the strip shows an overflow chevron. Clicking it opens a list of
  all open documents with search-as-you-type filtering so you can quickly jump to any tab.
- **Welcome Screen:** Shown when no document is selected.
- **Folder Overview:** Selecting a folder opens the Folder Overview, providing a summary of its contents and quick actions.
- **Document Editor:** The primary interface for writing and editing a document's content and title.
- **Template Editor:** A similar editor for creating and modifying document templates.
- **Settings View:** A dedicated screen for configuring the application.
- **Info View:** Displays documentation like the README and this manual.

#### Folder Overview Details

The Folder Overview organizes key insights about the currently selected folder so you can triage and navigate quickly.

- **Metrics Cards:** At the top of the overview, metric tiles display counts for documents, subfolders, and templates contained in the selection, along with the timestamp of the most recent change. Use these at-a-glance totals to gauge activity or verify that bulk operations completed as expected.
- **Document Type & Language Summaries:** Pie charts and legend rows aggregate the detected document types and languages inside the folder. Hovering or focusing on a slice reveals the exact counts so you can spot imbalances (for example, many notes still in plaintext instead of Markdown).
- **Recent Activity List:** The "Recent" section highlights the latest files touched within the folder. Entries include the title, relative path, and last modified time so you can reopen in-progress work or audit recent edits.
- **Folder Search Workflow:** Use the search field within the overview to filter across the folder hierarchy. Typing immediately narrows results by title, while pressing `Enter` runs a full-text query.
    - Matching documents show a contextual body snippet beneath the title. The snippet bolds the matched phrase, helping you confirm relevance without opening the document.
    - Results include badges that indicate whether the title, the body, or both fields matched, and they prioritize the most relevant and recently updated content.
    - A status pill above the results switches between "Searching…" and a match count, keeping you informed of the loading state while DocForge evaluates body matches.
    - Search results inherit the document type and language badges from the summaries, reinforcing how the item was classified.
    - Clearing the input restores the unfiltered metrics and recent list.
- **Opening Results:** Selecting an item from the recent list or search results opens it in the editor pane. Use `Ctrl+Enter` (`Cmd+Enter` on macOS) to open in a new tab if you have multi-tab editing enabled.

### The Status Bar

The bar at the bottom of the window provides at-a-glance information about the application's state.

- **LLM Connection Status:** A colored dot (green for connected, red for error) and text indicating the connection status to your local AI provider.
- **Provider & Model Selection:** Dropdown menus to see the currently configured LLM provider and model, and to quickly switch between other detected services and their available models.
- **Statistics:** Shows the total number of documents and the last save time for the active document.
- **App Version:** Displays the current version of DocForge.

---

## 2. Core Features

### Creating and Managing Documents and Folders

- **New Document:** Click the `+` icon at the top of the sidebar or use the `Ctrl+N` shortcut. New documents default to Markdown.
- **New Code File:** Click the code icon. A dialog will appear asking you to provide a filename with an extension (e.g., `script.js`) for automatic language detection.
- **New from Clipboard:** Use the command palette entry or sidebar menu item to create a document from the current clipboard contents. DocForge will import the text verbatim, detect the document type automatically, and report the classification in the activity log. If clipboard access is denied, the app shows guidance for restoring permissions.
- **New Root Folder:** Click the folder icon with a `+` to create a new folder at the root of your document list.
- **New Subfolder:** Select an existing folder and click the "New Subfolder" icon to create a folder inside it.
- **Duplicate Selection:** Select one or more items and click the "Duplicate" icon to create a deep copy.

### Exporting Documents

Use the **Save to File…** action whenever you need a local copy of a document outside DocForge.

- **From the Sidebar:** Hover a document in the tree and click the floppy disk quick action, or open the item's context menu and choose **Save to File…**.
- **From the Command Palette:** Type `Save Document to File` to export whichever document is currently focused in the tree.
- **Suggested Filenames:** DocForge proposes a sanitized filename based on the document title and strips any duplicate extension you might already have in the title.
- **Smart Extensions:** The exporter inspects the document type, detected language mode, and embedded MIME hints (for images and PDFs) to choose the most appropriate file extension automatically.
- **Binary Support:** Binary payloads such as PDFs and images are decoded before saving, so the exported file opens natively.
- **Desktop & Browser Friendly:** On Electron builds the action opens the operating system's save dialog; the web preview falls back to a standard browser download prompt.

If you cancel the dialog, the action silently stops so you can continue working without dismissing extra alerts.

### Editing Documents

The document editor is powered by Monaco, the same editor core used in VS Code, providing a rich and consistent experience for all document types.

- **Title:** The title of the document can be edited directly at the top of the editor.
- **Auto-Naming:** If the title is blank, the application can generate a title for you based on the content using your configured LLM (only for Markdown and plaintext files).
- **Content:** The main text area supports syntax highlighting for dozens of languages (e.g., Markdown, HTML, JavaScript, Python), code folding, and bracket matching.
- **Language Selector:** You can manually change the language for syntax highlighting using the dropdown menu in the editor's toolbar.
- **View Modes:** For document types that support a preview (like Markdown and HTML):
    - **Editor Only:** The default text editing view.
    - **Preview Only:** A rendered view of your content.
    - **Split Vertical/Horizontal:** A side-by-side or top-and-bottom view of the editor and the live preview.
- **Aligned Controls:** The language selector, Cancel Changes button, and preview toggles are grouped together so the toolbar stays organized even as you resize the window.
- **Toolbar Actions:**
    - **Save Version:** Manually save the current content as a new version in the document's history. The button icon will be highlighted when there are unsaved changes.
    - **Cancel Changes:** Discard all unsaved edits and revert to the last saved version without closing the tab or navigating away.
    - **Version History:** Open a view to see all saved versions of the document.
    - **Format:** Automatically tidy up supported languages—Markdown, JSON, JavaScript, and TypeScript—using DocForge's integrated formatter.
    - **Lock/Unlock:** Click the padlock icon to switch the document between editable and read-only modes. Locked documents disable title regeneration, formatting, AI refinement, and manual saves until you unlock them.
    - **Copy:** Copy the document's content to the clipboard.
    - **Refine with AI:** Send the document's content to your configured LLM to get an improved version (only for Markdown and plaintext files).
    - **Delete:** Delete the current document. A confirmation is required, where pressing `Enter` will confirm the action.

#### PDF Documents

Import PDFs by dragging `.pdf` files from your operating system into the sidebar, using the "Import" options in context menus, or converting clipboard data through **New from Clipboard** when it contains PDF bytes or data URLs. Opening a PDF switches the editor to **Preview Only** mode automatically so you can focus on the embedded viewer. The preview displays the document in an inline reader with Chromium's native toolbar (page navigation, zoom, and print controls) and honors keyboard shortcuts exposed by the viewer. DocForge synchronizes the viewer with the global preview zoom so the zoom buttons, scroll wheel shortcuts, and reset commands behave consistently across file types. Because PDFs are stored as binary data, editing is disabled by default; switching to the editor view will show the raw payload, and changing it can corrupt the file.

#### Image Documents

PNG, JPEG, GIF, BMP, WEBP, and SVG assets are detected when you import them from disk, drop them into the sidebar, or pipe image data through **New from Clipboard**. Image documents also open directly in **Preview Only** mode. The preview uses DocForge's zoom and pan surface so you can scroll, drag to reposition, double-click to zoom, or press the on-screen controls to reset the view. Image metadata—such as pixel dimensions and MIME type—appears in the status bar while the preview is active, and the renderer clamps the image inside the workspace with padding so large assets remain manageable. Editing the underlying binary/text data is optional but discouraged unless you are intentionally replacing the encoded image contents.

#### Python Execution Panel

DocForge includes an embedded Python runner that integrates with the editor when you're working on Python content.

- **When It Appears:** The Python panel automatically becomes available when the active document uses the Python language mode or when you explicitly enable the panel from the Command Palette. The panel docks beneath the editor and can be resized like other views.
- **Running Code:** Use the **Run** button or press `Shift+Enter` to execute the current document (or a selected code block). Execution happens inside the selected Python environment, and the panel keeps focus so you can iterate quickly without switching windows.
- **Viewing Logs:** The right side of the panel displays structured run output, including stdout, stderr, and exit status. Each run is timestamped, and you can expand entries to inspect detailed logs.
- **Managing Histories:** Every execution is stored in the document's history list within the panel. You can rename runs, pin important ones, clear individual entries, or purge the entire history. Switching documents automatically swaps in its associated Python run history.
- **Environment Controls:** A dropdown shows the interpreter that will be used. From here you can create a new virtual environment, switch to a detected interpreter, or open the environment folder in your system file browser.

#### Shell and PowerShell Execution Panel

Shell (`.sh`) and PowerShell (`.ps1`) documents expose a dedicated execution panel that mirrors the Python experience while honoring the nuances of each scripting language.

- **Test vs. Run:** Choose **Test Script** to perform a syntax-only check (Bash adds `-n`; PowerShell loads the script into a `ScriptBlock` under `Set-StrictMode`). Use **Run Script** for full execution. If the selected interpreter cannot support syntax-only mode (for example, Windows `cmd.exe`), DocForge reports the limitation before any code runs.
- **Environment Management:** Each document stores its own environment variables, working directory, and interpreter override. Values are entered as JSON and merge with the global defaults from Settings so you can combine organization-wide variables with script-specific secrets or toggles.
- **Defaults & Overrides:** Leave fields blank to inherit the workspace defaults. Provide a custom executable path to target alternate shells (e.g., `zsh`, a portable `pwsh`).
- **Run History & Logs:** Every invocation records the chosen mode, exit code, timestamps, and streamed stdout/stderr. Select a run from the Recent Runs list to review prior output alongside the active script.
- **Collapsible Layout:** Collapse the panel when you want more editor space—DocForge remembers the state per language.

### Organizing with Drag and Drop

You can organize your documents and folders by dragging and dropping them in the sidebar. You can select multiple items using `Ctrl+Click` (or `Cmd+Click` on macOS) and drag them all at once.

You can drop an item (or a group of items):
- **Before** another item to place it above.
- **After** another item to place it below.
- **Inside** a folder to move it into that folder.

**Importing from your computer:** You can also drag files and folders directly from your operating system's file explorer into the sidebar. Dropping them on a folder will import them into that folder, while dropping them in an empty area will import them to the root. The original folder structure is preserved.

### AI-Powered Refinement

Clicking the **Refine with AI** (sparkles) button in the editor toolbar sends your current document content to your configured local LLM. The AI's task is not to *answer* the document's request, but to *improve* the document itself. A modal will appear with the suggested refinement, which you can then accept or discard. The "Accept" button is the default and can be triggered by pressing `Enter`. This feature is available for Markdown and plaintext documents.

### Using Templates

Templates are useful for documents you create often.

- **Create a Template:** Use the "New Template" button in the sidebar. In the template editor, use `{{variable_name}}` syntax to define placeholders.
- **Create from Template:** Click the "New from Template..." icon in the sidebar's document toolbar. A modal will appear allowing you to select a template and fill in the values for its variables. This will generate a new document with the content filled in. Pressing `Enter` in this dialog will create the document once all required fields are filled.

### Version History

DocForge allows you to maintain a complete history of your document's content.
- **Saving a Version:** A new version is created only when you click the **Save Version** (disk) icon in the editor's toolbar. This gives you full control over when a snapshot is recorded.
- **Viewing History:** Click the **History** icon in the editor toolbar to open the history view.
- **Managing History:**
    - In the history view, you can select any previous version to see a "diff" comparing it to the version before it.
    - You can copy content from an old version or restore the entire document to that state.
    - You can select one or more old versions using the checkboxes and delete them permanently. This action requires confirmation, which can be accepted by pressing the `Enter` key.

---

## 3. Views and Panels

### Command Palette

The Command Palette is the fastest way to access most of DocForge's features.
- **Open:** Click the search box in the center of the title bar or press `Ctrl+Shift+P`.
- **Use:** Type to filter commands. Use the arrow keys to navigate and `Enter` to execute an action.

### Settings View

Accessed via the gear icon in the title bar. The settings are organized into categories:
- **LLM Provider:** Configure your connection to a local AI service. You can detect running services and select a model.
- **Appearance:** Change the UI scale and choose from different icon sets.
- **Keyboard Shortcuts:** View and customize keyboard shortcuts for all major application actions. You can record a new key combination for any command.
- **General:** Configure application behavior, like auto-saving logs, opting into pre-release updates, and choosing how PlantUML diagrams are rendered. This section includes an **Automatic Update Checks** toggle that determines whether DocForge contacts the update service on launch, a **Pre-release Updates** toggle that opts into beta builds, and a **Check for Updates** button for running a manual scan on demand. Manual checks report their status inline—showing a spinner and "Checking…" label during the request, a success message when you're current or when a download starts, and an error message with troubleshooting details if the update service is unreachable or disabled in the web preview.
- **Python:** Choose the interpreter used by the integrated runner. DocForge auto-detects local interpreters, can bootstrap a dedicated virtual environment per workspace, and exposes console preferences such as default working directory, automatic history retention, and whether runs open in split view.
- **Shell & PowerShell:** Define default environment variables, working directories, and interpreter overrides for each scripting language. Document-specific panels start with these defaults and can layer additional overrides without mutating the workspace baseline.
- **Database:** View detailed statistics about your local database file, and perform maintenance tasks such as creating a compressed backup, checking file integrity, optimizing the database size (`VACUUM`), or bootstrapping a brand new workspace database.
- **Advanced:** View and edit the raw JSON configuration file using an interactive tree or a raw text editor, and import/export your settings.

### Info View

Accessed via the info icon in the title bar. This view contains tabs for reading the application's `README.md`, this `FUNCTIONAL_MANUAL.md`, the `TECHNICAL_MANUAL.md`, and the `VERSION_LOG.md`.

#### PlantUML Rendering Modes

The **General** settings category includes a **PlantUML Rendering** selector. Choose between:

- **Remote (plantuml.com):** Encodes the diagram and requests the SVG from the public PlantUML server.
- **Offline (local renderer):** Invokes the PlantUML jar bundled with the application (`assets/plantuml/plantuml.jar`) through the local Java Runtime Environment, letting the app render diagrams without contacting plantuml.com.

If the Java runtime is unavailable, DocForge will report the error in the preview and you can switch back to remote rendering at any time.

The chosen rendering mode is used for PlantUML code blocks inside Markdown documents *and* for standalone `.puml` documents rendered through the dedicated PlantUML previewer.

### Logger Panel

Accessed via the terminal icon in the title bar, this panel is your primary tool for debugging and monitoring application activity.

- **Integrated Layout:** The panel is part of the main application layout. When opened, it pushes the content above it upwards, rather than covering it. This ensures the main screen remains fully interactive. The panel's height is resizable by dragging its top border.
- **Action Logging:** The logger automatically records every significant action you take in the application, such as creating a document, changing a setting, or using a command. This provides a clear history of operations.
- **Filtering:** You can filter logs by level (DEBUG, INFO, WARNING, ERROR).
- **Actions:** You can clear the logs or save the current session's log to a file.