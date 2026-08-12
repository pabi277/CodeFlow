# CodeFlow 💻

A **mobile-first Progressive Web App** that brings a VS Code–style IDE experience to Android phones. Entirely a web app — install it from the browser, no app store required.

Built to make a developer feel like they have a real IDE in their pocket: a responsive editor, a touch-optimized keyboard toolbar, cloud code execution, offline editing, and (in Phase 2) GitHub integration.

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
| **Markdown / HTML preview** — live preview, split, or preview-only for `.md` / `.html` / `.svg` | ✅ |
| **Breadcrumbs** — tap a folder to reveal it in the explorer | ✅ |
| **Problems panel** — JSON, brackets, markdown fences, HTML/YAML checks with jump-to-line | ✅ |
| **Outline** — functions/classes/variables for the active file | ✅ |
| **Status bar** — line/col, language, indent, error/warning counts | ✅ |
| **Go to Line** — command palette + Ctrl/Cmd+G | ✅ |
| **Format Document** — JSON pretty-print + trailing-whitespace cleanup | ✅ |
| **Keyboard shortcuts** — palette, find, go-to-line, drawer, terminal, format | ✅ |

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
delegates the code→token exchange to a small backend proxy. A ready-to-deploy
**Cloudflare Worker** lives in [`/worker`](./worker).

1. Register a GitHub **OAuth App** (Settings → Developer settings → OAuth Apps).
   Set the callback URL to `https://your-app.example.com/auth/callback`.
2. Deploy the worker and set its secrets:
   ```bash
   cd worker
   wrangler deploy
   wrangler secret put GITHUB_CLIENT_ID
   wrangler secret put GITHUB_CLIENT_SECRET
   ```
3. Configure the frontend in `src/services/authService.ts`:
   - `clientId` → your OAuth App's Client ID
   - `tokenProxyUrl` → your deployed worker's `/exchange` URL
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
npm run test             # run all seven suites
```


## 🔐 Security notes

- GitHub client secret never ships in frontend code — the Phase 2 token exchange requires a small backend proxy (Cloudflare Worker / Vercel function).
- GitHub tokens are stored in **IndexedDB**, never localStorage/cookies/URL.
- All API calls use HTTPS; user code runs only in Judge0's sandbox.

---

Made with React, CodeMirror 6, Dexie, Zustand, Tailwind CSS & Vite.
