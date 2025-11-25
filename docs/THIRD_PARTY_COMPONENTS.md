# Third-Party Components and Libraries

This document enumerates the third-party packages used by DocForge, along with links to their homepages or repositories, short descriptions, and where each library is used.

## Runtime dependencies

| Package | Link | Description | Key usage in the app |
| --- | --- | --- | --- |
| React / React DOM | https://react.dev / https://react.dev/reference/react-dom | UI library powering the renderer process. | Application root rendering in `index.tsx` and most React components. |
| lexical / @lexical/* | https://lexical.dev/ | Rich-text editor framework and React bindings. | `components/RichTextEditor.tsx` builds the editor with Lexical plugins; `components/rich-text/ImageNode.tsx` defines custom nodes; `components/PromptEditor.tsx` toggles Lexical mode. |
| @uiw/react-color-compact | https://github.com/uiwjs/react-color | Color picker component. | Used by `components/ColorPicker.tsx` to select swatches. |
| better-sqlite3 | https://github.com/WiseLibs/better-sqlite3 | Native SQLite bindings for Node.js. | `electron/database.ts` manages the local document database. |
| electron | https://www.electronjs.org/ | Desktop shell combining Chromium and Node.js. | Main process code in `electron/main.ts`, preload bridge in `electron/preload.ts`, and renderer entry in `index.tsx`. |
| electron-log | https://github.com/megahertz/electron-log | Structured logging for Electron apps. | Configured in `electron/main.ts` to capture main-process logs. |
| electron-updater | https://www.electron.build/auto-update | Auto-update client for Electron Builder. | Auto-update scheduling and GitHub provider overrides in `electron/main.ts`. |
| electron-squirrel-startup | https://github.com/mongodb-js/electron-squirrel-startup | Handles Squirrel.Windows startup events. | Bundled for Windows installers produced via Electron Builder. |
| emoji-picker-react | https://github.com/ealush/emoji-picker-react | Emoji selection UI component. | Emoji overlay implemented in `components/EmojiPickerOverlay.tsx`. |
| uuid | https://github.com/uuidjs/uuid | RFC 4122 UUID generator. | Document and node identifiers in `electron/database.ts`. |
| @lexical/react | https://github.com/facebook/lexical/tree/main/packages/lexical-react | React integration for Lexical. | Editor composition and plugins inside `components/RichTextEditor.tsx`. |
| @lexical/rich-text | https://github.com/facebook/lexical/tree/main/packages/lexical-rich-text | Rich-text nodes/commands for Lexical. | Formatting behavior in `components/RichTextEditor.tsx`. |
| @lexical/list | https://github.com/facebook/lexical/tree/main/packages/lexical-list | List node support for Lexical. | Ordered/unordered list handling within `components/RichTextEditor.tsx`. |
| @lexical/link | https://github.com/facebook/lexical/tree/main/packages/lexical-link | Link nodes and commands for Lexical. | Link plugin configuration in `components/RichTextEditor.tsx`. |
| @lexical/html | https://github.com/facebook/lexical/tree/main/packages/lexical-html | HTML import/export helpers for Lexical. | Converting between HTML and editor state in `components/RichTextEditor.tsx`. |

## Build, testing, and content rendering

| Package | Link | Description | Key usage in the app |
| --- | --- | --- | --- |
| @testing-library/react / @testing-library/jest-dom | https://testing-library.com/ | React component testing utilities. | GUI tests under `services/preview/__tests__` and other component tests. |
| @types/react / @types/react-dom / @types/uuid / @types/katex | https://www.npmjs.com/package/@types/react etc. | TypeScript type definitions. | Provide typings for React, UUID, and KaTeX across the codebase. |
| @vitejs/plugin-react | https://github.com/vitejs/vite/tree/main/packages/plugin-react | Vite plugin enabling React Fast Refresh and JSX transform. | Configured in `vite.config.ts`. |
| autoprefixer | https://github.com/postcss/autoprefixer | Adds vendor prefixes to CSS. | Used via `postcss.config.js` during Tailwind builds. |
| electron-builder | https://www.electron.build/ | Packaging and distribution tooling for Electron apps. | Build scripts in `package.json` rely on it to create installers. |
| esbuild | https://esbuild.github.io/ | Fast bundler/transpiler. | Custom build pipeline in `esbuild.config.js`. |
| fast-xml-parser | https://github.com/NaturalIntelligence/fast-xml-parser | Lightweight XML parser. | Icon generation script `scripts/prepare-icons.mjs`. |
| http-server | https://github.com/http-party/http-server | Simple static file server. | `npm run dev:web` serves the built app for preview. |
| icon-gen | https://github.com/akabekobeko/npm-icon-gen | Icon generation from SVG/PNG. | Used in `scripts/prepare-icons.mjs`. |
| jsdom | https://github.com/jsdom/jsdom | DOM implementation for Node.js. | Testing environment for markdown renderer and other components. |
| katex | https://katex.org/ | Math typesetting for the web. | Math rendering in `services/preview/markdownRenderer.tsx`. |
| mermaid | https://mermaid.js.org/ | Diagram rendering from text definitions. | Mermaid blocks rendered in `services/preview/markdownRenderer.tsx`. |
| plantuml-encoder | https://github.com/markushedvall/plantuml-encoder | Encodes PlantUML diagrams for server rendering. | PlantUML handling in `services/preview/plantumlDiagram.tsx`. |
| postcss | https://postcss.org/ | CSS processing framework. | Tailwind and PostCSS pipeline via `postcss.config.js`. |
| react-markdown | https://github.com/remarkjs/react-markdown | Markdown renderer for React. | Core markdown rendering in `services/preview/markdownRenderer.tsx`. |
| rehype-katex / rehype-raw / rehype-slug | https://github.com/rehypejs/rehype-katex etc. | Rehype plugins for math, raw HTML, and heading anchors. | Markdown rendering pipeline in `services/preview/markdownRenderer.tsx`. |
| remark-gfm / remark-math | https://github.com/remarkjs/remark-gfm | Remark plugins for GitHub-flavored markdown and math. | Markdown parsing in `services/preview/markdownRenderer.tsx`. |
| shiki | https://github.com/shikijs/shiki | Syntax highlighter using VS Code grammars. | Code block highlighting via `services/preview/shikiHighlighter.ts`. |
| tailwindcss | https://tailwindcss.com/ | Utility-first CSS framework. | Style generation from `styles/tailwind.css` using `tailwind.config.ts`. |
| typescript | https://www.typescriptlang.org/ | Typed superset of JavaScript. | Source language across the repository. |
| vitest | https://vitest.dev/ | Vite-native test runner. | Markdown renderer tests in `services/preview/__tests__/markdownRenderer.test.tsx` and other suites. |
| yaml | https://eemeli.org/yaml/ | YAML parser and serializer. | Release tooling (`scripts/generate-release-notes.mjs`, `scripts/test-auto-update.mjs`) and tests. |
