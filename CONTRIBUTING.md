# Contributing to CodeFlow

Thanks for helping make a mobile-first editor better. This project is MIT-licensed and welcomes issues, docs, and pull requests.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # full suite
npm run lint     # oxlint
```

Please run `npm test` before opening a PR.

## How to help

- **Bugs** — open an [issue](https://github.com/pabi277/CodeFlow/issues) with steps, expected vs actual, and device/browser.
- **Features** — open an issue first so we can talk through UX on a phone-sized screen.
- **Docs** — README, Termux setup, and in-app copy are first-class.
- **Code** — keep the existing style: TypeScript, Zustand, small focused files, mobile-first Tailwind.

## Pull requests

1. Fork and branch from `main` (`feat/…` or `fix/…`).
2. Keep the diff focused. Match nearby naming and comments.
3. Add or extend a test in `scripts/` when you change behavior.
4. Do not commit `node_modules`, secrets, or OAuth client secrets.
5. Fill in the PR template.

## Project map

- `src/components` — UI
- `src/store/useStore.ts` — app state
- `src/services` — Judge0, GitHub, Termux
- `public/termux-bridge.js` — local execution + preview server
- `scripts/` — Node test suites (`npx tsx …`)

## Code of conduct

Be kind. See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
