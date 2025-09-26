# Version Log

## v0.2.4

### 🐛 Bug Fixes & Minor Enhancements
- **Keyboard Navigation:** Fixed a critical bug in the sidebar's keyboard navigation where the visual focus and editor content would not update correctly when using arrow keys. Navigation is now reliable and behaves as expected.

## v0.2.3

### ✨ New Features & Major Improvements
- **Keyboard Navigation:** Implemented full keyboard navigation for the sidebar. Users can now use arrow keys to navigate through prompts, templates, and folders, expand/collapse folders, and select items without using the mouse.

### 🐛 Bug Fixes & Minor Enhancements
- **JSON Editor:** Fixed a bug where typing a space in the JSON settings editor would cause the cursor to jump to the end of the file.
- **UI Scaling:** Resolved an issue where tooltips and the command palette could be misaligned when the application's UI scale was set to a value other than 100%.

## v0.2.2

### 🐛 Bug Fixes & Minor Enhancements
- **Editor Splitter:** Fixed an issue where the horizontal and vertical splitters in the prompt editor could become unresponsive or "stuck" during resizing, ensuring smooth and reliable layout adjustments. This also removes verbose debug logging for splitter movements.
- **UI Polish:** Adjusted tooltip positioning logic to be closer to the window edges and better account for different UI scales.

## v0.2.1

### ✨ New Features & Major Improvements
- **Settings Redesign:** Overhauled the Settings panel with a modern, space-efficient, single-page layout. It now features scroll-spy navigation on the left that tracks your position as you scroll through the categories on the right, making it easier and faster to configure the application.

### 🐛 Bug Fixes & Minor Enhancements
- **Splitter Reliability:** Resolved an issue with the sidebar splitter having limited travel; it can now be resized freely across the full width of the application window.
- **Template Creation:** Fixed a critical bug where creating a new prompt from a template would fail to apply the template's content and title.
- **UI Polish:** Removed distracting blue focus rectangles from all buttons in the custom title bar for a cleaner, more professional aesthetic.
- **TypeScript:** Corrected minor TypeScript errors in the Settings view that could occur due to incorrect type inference in a React hook.

---

## v0.2.0 - The "Modern UI" Update

### ✨ New Features & Major Improvements
- **New Custom Title Bar:** Implemented a frameless window with a custom, VS Code-style title bar for a modern, desktop-integrated feel (Electron version only).
- **Integrated Command Palette:** The command palette search is now built directly into the title bar, appearing as a seamless dropdown for quick access to all functions.
- **Consolidated UI:** Relocated all global actions (Settings, Info, Logs, etc.) to the new title bar, removing the old header and streamlining the status bar to maximize vertical space.
- **Custom Confirmation Dialogs:** Replaced all native OS confirmation dialogs with a custom, styled modal to ensure a cohesive design across all platforms.
- **Window Controls:** Added custom, platform-aware window controls (minimize, maximize, close) to the title bar.
- **Enhanced Drag & Drop:** Overhauled the sidebar's drag-and-drop system to be more intuitive and robust, supporting multi-select, dropping into empty folders, and providing clearer visual indicators.

### 🐛 Bug Fixes & Minor Enhancements
- **Focus Management:** Resolved critical focus-loss bugs with the command palette search input and the prompt editor, ensuring a smooth keyboard-driven workflow.
- **UI Scaling:** Fixed positioning problems for the command palette and tooltips at different UI scales, ensuring they appear correctly regardless of zoom level.
- **Splitter Reliability:** Completely resolved issues where the vertical and horizontal splitters would get "stuck", ensuring smooth and full-range resizing.
- **Markdown Rendering:** Corrected an issue where a large whitespace would appear above the first line of rendered Markdown content.
- **Build System Hardening:** Fixed several critical build and packaging errors related to dependencies and application icons, resulting in a stable and reliable build process.
- **UI Polish:** Removed distracting blue focus rings from all buttons in the header and title bar area for a cleaner look.

## v0.1.11
### ✨ New Features & Major Improvements
- **Markdown Preview:** Added a live Markdown preview to the prompt editor. Users can now toggle between the editor, a rendered preview, and side-by-side split views (vertical or horizontal).
- **Editor Toolbar Redesign:** Removed the bottom action bar and consolidated all controls (Undo, Redo, Refine, Delete, etc.) into a single, unified toolbar at the top of the editor for a cleaner layout.
- **Improved Tooltips:** Tooltips now appear instantly on all icon buttons, providing clear and immediate feedback.
- **Borderless Editor Layout:** The editor view now uses the full available client area, removing unnecessary borders and padding for a more expansive and focused writing experience.

### 🐛 Bug Fixes & Minor Enhancements
- **UI Scaling:** Fixed an issue where tooltips were not positioned correctly when the UI scale was set to something other than 100%.
- **Editor Background:** Ensured the editor background is pure white in light mode for better contrast and readability.
- **Disabled Button Tooltips:** Fixed a bug where tooltips would not appear on disabled buttons (e.g., Undo when there's no history).
- **Markdown Spacing:** Corrected an issue where a large whitespace would appear above the first line of rendered Markdown content if it was a heading.

## v0.1.10
### ✨ New Features & Major Improvements
- **Prompt Version History:** The application now automatically saves a new version of a prompt every time its content is significantly changed.
- **History Viewer:** A new "History" view is accessible from the editor, allowing users to:
    - See a timeline of all saved versions.
    - View a "diff" of the changes between a selected version and the one before it.
    - Copy content from or restore the entire prompt to a previous version.
- **LLM Discovery:** The settings panel now automatically discovers and lists running local LLM services (Ollama, LM Studio), making provider configuration much easier. The status bar also allows for quick switching between discovered providers and their models.

### 🐛 Bug Fixes & Minor Enhancements
- **Settings UX:** The Settings view is now a full-screen takeover instead of a modal, with settings organized into categories for better usability.
- **Auto-Naming:** Improved the logic for auto-naming prompts to be more reliable.
- **Refined Welcome Screen:** Polished the welcome screen's appearance.

## v0.1.9
### ✨ New Features
- **Prompt Templating:**
    - Users can now create, edit, and delete reusable prompt templates.
    - Templates support `{{variable}}` syntax for placeholders.
    - A new "New from Template..." feature allows users to select a template, fill in the variables, and generate a new prompt.
- **Hierarchical Organization:**
    - Added support for creating folders to organize prompts.
    - Implemented full drag-and-drop functionality for prompts and folders in the sidebar.
- **Enhanced Sidebar:**
    - The sidebar now uses a tree view to display the folder structure.
    - Folders can be expanded and collapsed, and their state is saved.
    - Full keyboard navigation (arrow keys, Enter) is now supported for all items in the sidebar.
- **Command Palette:** Added a command palette (`Ctrl+Shift+P`) for quick access to common actions like creating new prompts, folders, and templates.

### 🐛 Bug Fixes & Minor Enhancements
- **UI Polish:** Numerous small UI improvements, including better focus management, consistent button styles, and refined layouts.
- **State Management:** Refactored state management for prompts to handle the new folder structure efficiently.

## v0.1.8
### ✨ New Features
- **Auto-Update:** The application now automatically checks for updates on startup. When an update is downloaded, a notification appears with an option to restart and install.
- **Prerelease Channel:** Added a setting to allow users to opt-in to receiving beta and pre-release versions.
- **Settings Import/Export:** Users can now export their settings to a JSON file and import them on another machine.

### 🐛 Bug Fixes
- **Log Auto-Saving:** The "Auto-save Logs" feature is now functional in the Electron version.

## v0.1.7 and below
- Initial versions of the application. Features include core prompt editing, AI refinement, settings management, light/dark themes, multiple icon sets, and logging.