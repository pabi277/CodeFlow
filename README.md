# CodeFlow

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

**A free, open-source, mobile-first code editor.** Install it from the browser — no app store.

Write Python, JavaScript, HTML and more on your phone. Run code, preview the web, and push to GitHub. Works offline.

- **Edit** — CodeMirror 6, tabs, file tree, find, snippets, themes
- **Run** — JS in the browser; Python and more via Termux or Judge0
- **Preview** — live HTML/CSS/JS, optional new tab, Termux live server
- **Ship** — clone, commit, push, pull, diffs, branches

New here? Open the app, tap **How does it work?**, then **New project (with sample files)**.

Contributions welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Licensed under [MIT](./LICENSE).

---

Built to make a developer feel like they have a real IDE in their pocket: a responsive editor, a touch-optimized keyboard toolbar, cloud code execution, offline editing, and GitHub integration.

---

## ✨ What's implemented (Phase 1 — MVP)

| Area | Status |
| --- | --- |
| Project scaffold (Vite + React + TS + Tailwind) | ✅ |
| **IndexedDB data layer** (Dexie) — files, projects, settings, editor state, execution history, GitHub auth stores | ✅ |
| **UI shell** — top bar, tab bar, editor area, left drawer | ✅ |
| **CodeMirror 6 editor** with lazy-loaded syntax highlighting (Python, JS, TS, C/C++, Java, HTML, CSS, JSON, Markdown, Go, Rust, PHP, SQL, XML, YAML, Vue, etc.) | ✅ |
| **File explorer** — tree view, search, create/rename/delete/duplicate, long-press context menu | ✅ |
| **Tab system** — open files, active tab, dirty indicator, close with confirm | ✅ |
| **Keyboard toolbar** — language-aware shortcut keys, arrow keys for cursor movement | ✅ |
| **Code execution** — Judge0 (RapidAPI) with **local JS runner + mock fallback** when no API key | ✅ |
| **Terminal panel** — draggable resize, color-coded stdout/stderr/system, stdin input, run history | ✅ |
| **Command palette** — fuzzy search over commands & files | ✅ |
| **Settings** — editor, appearance (theme presets), auto-save, keyboard toolbar, execution, storage | ✅ |
| **PWA** — web app manifest, Workbox service worker, offline app-shell caching, install banner | ✅ |
| Zustand store with slices (files/editor/execution/github/ui/settings) | ✅ |
| **GitHub OAuth** — full flow with backend-proxy token exchange (Cloudflare Worker included) | ✅ |
| **Repository browser** — searchable repo list, clone with live progress | ✅ |
| **Clone repository** — fetches tree, creates folders/files, batches blob fetches (10 at a time) | ✅ |
| **Modified-file tracking** — modified/new/deleted indicators, Git tab change list | ✅ |
| **Commit & Push** — staging checkboxes, commit message, blob→tree→commit→ref flow | ✅ |
| **Pull** — creates/updates remote files, flags conflicts without auto-resolving | ✅ |
| **Diff viewer** — unified diff, revert (discard) per file | ✅ |
| **Branch switching** — list branches and switch | ✅ |

**Phase 3 — polish & enhancement**

| Area | Status |
| --- | --- |
| **Find & Replace in file** — CodeMirror search panel (via menu & command palette) | ✅ |
| **Find in Project** — full-text search across all files with match-case toggle | ✅ |
| **Theme presets** — 7 full palettes (Default Dark, Dracula, Monokai, Ayu Mirage, Tokyo Night, GitHub Dark/Light) applied to the **app shell and the editor** | ✅ |
| **Settings expansion** — font family, cursor style, spaces-vs-tabs, per-language keyboard-toolbar editor, GitHub rate-limit status | ✅ |
| **Auto-save indicator** — "saved/unsaved" status in the top bar | ✅ |
| **Accessibility** — focus-visible outlines, reduced-motion support, touch-action, ARIA labels | ✅ |
| **Performance pass** — removed ineffective dynamic imports, lazy language chunks | ✅ |

**Phase 4 — differentiating features**

| Area | Status |
| --- | --- |
| **Run configurations** — set any file as the "main" file to run; ▶ runs it | ✅ |
| **Execution history browser** — full-screen log of past runs with one-tap **Rerun** | ✅ |
| **Snippet library** — save/edit/delete snippets with `${cursor}` placeholder, per-language filtering, insert into editor | ✅ |
| **Git history viewer** — read-only commit log for the connected repo | ✅ |
| **Pull requests viewer** — read-only list of open PRs | ✅ |
| **Landscape split editor** — file list sidebar beside the editor when in landscape | ✅ |
| **Plugin architecture** — plugin registry + enable/disable toggles; built-ins: history, snippets, git log, PRs | ✅ |
| **Command palette** — plugin commands surfaced automatically | ✅ |

**Phase 5 — IDE chrome**

| Area | Status |
| --- | --- |
| **Code minimap** — canvas overview of the file, click/drag to scroll (Settings toggle) | ✅ |
| **Markdown / HTML preview** — dedicated viewer with refresh + optional new tab; Termux v2 serves the project as a live server so CSS/JS/images load for real | ✅ |
| **Multi-file run** — Termux receives the whole project, so Python/Node imports resolve | ✅ |
| **Breadcrumbs** — tap a folder to reveal it in the explorer | ✅ |
| **Problems panel** — JSON, brackets, markdown fences, HTML/YAML checks with jump-to-line | ✅ |
| **Outline** — functions/classes/variables for the active file | ✅ |
| **Status bar** — line/col, language, indent, error/warning counts | ✅ |
| **Go to Line** — command palette + Ctrl/Cmd+G | ✅ |
| **Format Document** — Prettier for JS/TS/HTML/CSS/Markdown; JSON pretty-print | ✅ |
| **Multi-cursor** — Ctrl/Cmd+D, Alt+click, toolbar Next | ✅ |
| **Emmet** — Tab expands HTML/CSS abbreviations | ✅ |
| **Find & replace in project** — regex, whole word, replace all | ✅ |
| **Keyboard shortcuts** — palette, find, go-to-line, drawer, terminal, format | ✅ |

**Phase 6 — VS Code-style editor**

| Area | Status |
| --- | --- |
| **Column / box selection** — Shift+Alt+drag | ✅ |
| **Indent guides + rainbow brackets + sticky scroll** | ✅ |
| **Smart selection** — Ctrl/Cmd+I expands to the parent syntax node | ✅ |
| **Smooth cursor** — setting now actually applied | ✅ |
| **Linked HTML tag rename** — edit an opening tag, the closer follows | ✅ |
| **Format on save / paste** + **auto-detect indent** | ✅ |
| **Go to definition / references / rename** — F12, Shift+F12, F2 | ✅ |
| **Import path completion** — `from './` lists project files | ✅ |
| **Workspace symbol search** — Ctrl/Cmd+T | ✅ |
| **Pinned tabs, tab context menu, drag-to-reorder, scroll buttons** | ✅ |
| **Zen mode** — Ctrl+K Z | ✅ |
| **Create / delete Git branches** + **conflict resolver** + **side-by-side diff** | ✅ |
| **ANSI colors + clickable paths** in the terminal | ✅ |
| **Import a VS Code theme JSON** | ✅ |
| **Async JS sandbox** — top-level await + timers | ✅ |
| **Move files**, persist cursor/scroll, LF/CRLF toggle | ✅ |
| **Snippet tab-stops**, HTML auto-close tags, image preview | ✅ |
| **Configurable Termux URL**, offline Git guards, `.editorconfig` | ✅ |

## 🧱 Architecture

```
src/
├── components/        React UI, organized by feature
│   ├── FileExplorer/  tree view, search, create modal, context menu
│   ├── Editor/        CodeMirror wrapper
│   ├── Terminal/      output panel, stdin, history
│   ├── Shared/        buttons, modals, toasts, bottom sheets, context menu
│   ├── Drawer.tsx     left drawer (Files / Git tabs)
│   ├── TopBar.tsx, TabBar.tsx, KeyboardToolbar.tsx, CommandPalette.tsx, Settings.tsx, Home.tsx
├── services/          judge0Service, githubService, authService, mockRunner
├── db/                Dexie schema + CRUD (files, projects, settings, editorState, history, github)
├── store/             Zustand store (single global store, organized in slices)
├── hooks/             usePWA
├── editor/            lazy language loaders, CodeMirror themes
├── config/            judge0 languages, defaults, api endpoints
├── types/             all TypeScript definitions
└── utils/             language detection, path, formatting, debounce, error parsing
```

## 🗄️ Data model (IndexedDB — `CodeFlowDB`)

- **files** — unified file/folder records (id, name, type, path, content, parentId, childIds, timestamps, git flags, projectId)
- **projects** — project records with root folder ref + GitHub metadata
- **settings** — single key-value settings row
- **editorState** — open tabs, active tab, terminal state
- **executionHistory** — past run results
- **gitHubAuth** — OAuth token storage
- **snippets** — user-defined code snippets (name, description, language, body)

## ▶️ Running code

- **JavaScript / TypeScript** run **locally** in a sandboxed `Function` capturing `console` — no API key needed.
- **Other languages** require a **Judge0 CE API key** (RapidAPI). Paste it in **Settings → Execution**. Without a key, those languages show a friendly mock so the flow still works.
- Stdin is provided via the **Input** toggle in the terminal panel.

## 🚀 Getting started

```bash
npm install
npm run dev      # start the dev server (Vite)
npm run build    # production build + PWA service worker
npm run preview  # preview the production build
npm run test     # run the full test suite
```

> 💡 Open the dev server on your Android phone (or use the live preview) and **Add to Home Screen** to install it as a PWA.

## 🔐 Setting up GitHub OAuth (Phase 2)

The GitHub OAuth **client secret** must never ship in frontend code, so the app
delegates the code→token exchange to a small backend proxy. On Vercel this is
the serverless function at [`/api/exchange`](./api/exchange.js); a Cloudflare
Worker alternative lives in [`/worker`](./worker).

1. Register a GitHub **OAuth App** (Settings → Developer settings → OAuth Apps).
   Set the callback URL to `https://your-app.example.com/auth/callback`.
2. On Vercel, set these environment variables (Dashboard → Settings →
   Environment Variables):
   - `VITE_GITHUB_CLIENT_ID` → your OAuth App's Client ID (frontend build)
   - `GITHUB_CLIENT_ID` → your OAuth App's Client ID (serverless function)
   - `GITHUB_CLIENT_SECRET` → your OAuth App's Client secret (serverless
     function only — never expose it in the frontend)
3. `vercel.json` already rewrites `/api/*` to the serverless functions and
   `/auth/callback` to the SPA, so no extra routing config is needed.
4. Rebuild. Users can now tap **Connect GitHub** in the Git tab.

## 🖥️ Termux Integration

Run code **locally on your Android device** for free, unlimited, offline execution.
The `termux-bridge.js` server (in `/public`) runs inside Termux on `localhost:8080`, and CodeFlow
executes code there for any installed language (Python, C/C++, Java, Bash, Node...).

**Priority chain** (best → fallback):
1. JavaScript / TypeScript → runs **in the browser** (always)
2. Other languages → **Termux bridge** (if running)
3. → **Judge0** (if API key configured)
4. → **mock output** (always works)

The bridge (`public/termux-bridge.js` / `.cjs`) runs **real** code locally with a 10s timeout,
stdin piping, temp-file cleanup, and startup checks. Supported languages: Python, JavaScript,
TypeScript, C, C++, Java, Bash, Ruby, PHP, Go, Rust, Kotlin, Perl, Lua. It reports
`source: "termux"` so the terminal shows the green **"Ran in Termux"** badge.

Setup is ~5 minutes — see **[docs/termux-setup.md](docs/termux-setup.md)** or use the in-app
guide under **Settings → Execution → Termux Integration** (with a *Copy Bridge Script* button).
The terminal shows a color-coded badge for the execution source: local / Termux / Judge0 / mock.

## ✍️ Plugins

CodeFlow has a lightweight plugin system (`src/plugins/registry.ts`). A plugin
registers a name, optional description, optional command-palette entries, and an
optional React panel. Enable/disable them anytime in **Settings → Plugins**.
Built-in plugins: Execution History, Snippet Library, Git History, Pull Requests.
To add your own, call `registerPlugin({...})` and import it in `initBuiltinPlugins()`.

## 🧪 Tests

```bash
npm run test:git         # clone / status / commit / pull (fake GitHub + IndexedDB)
npm run test:snippets    # snippet store CRUD + persistence
npm run test:completions # autocomplete templates, local symbols, cursor placement
npm run test:execution   # execution priority chain (local/mock fallback)
npm run test:zip         # project ZIP export/import round-trip
npm run test:bridge      # Termux bridge real execution (python/C, stdin, health)
npm run test:smoke       # mount all screens + App boot transition (React #310 guard)
npm run test:diagnostics # problems engine (JSON, brackets, markdown, YAML)
npm run test:markdown    # preview renderer + XSS URL guards
npm run test:format      # JSON pretty-print + whitespace cleanup
npm run test:html-preview # HTML preview inlines local CSS/JS/@import
npm run test:ide         # indent, ANSI, symbols, imports, theme import
npm run test             # run all suites
```


## 🔐 Security notes

- GitHub client secret never ships in frontend code — the Phase 2 token exchange requires a small backend proxy (Cloudflare Worker / Vercel function).
- GitHub tokens are stored in **IndexedDB**, never localStorage/cookies/URL.
- All API calls use HTTPS; user code runs only in Judge0's sandbox.

---

## Contributing

Issues and PRs are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and the [code of conduct](./CODE_OF_CONDUCT.md). Security reports: [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © CodeFlow contributors.

Made with React, CodeMirror 6, Dexie, Zustand, Tailwind CSS & Vite.
