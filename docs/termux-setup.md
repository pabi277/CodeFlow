# Termux Integration Setup Guide

CodeFlow can execute code **directly on your Android device** using [Termux](https://termux.dev/).
This gives you unlimited, free, offline execution for any language installed in Termux —
no cloud API, no rate limits, no network needed.

## Why use it?

- ✅ **Unlimited executions** — no API rate limits
- ✅ **Free forever** — no API costs
- ✅ **Works offline** — no internet needed
- ✅ **Faster** — no network latency
- ✅ **Private** — your code never leaves your device
- ⚠️ Requires a one-time setup (~5 minutes)

## How it works

A browser (the PWA) cannot run commands in Termux directly. Instead, CodeFlow talks to a
tiny HTTP bridge that you run inside Termux. v2 also **syncs the open project** so:

- HTML preview loads real CSS/JS/images from `http://127.0.0.1:8080/preview/…`
- Python / Node can `import` other files in the project

```
CodeFlow (browser)  ──HTTP (localhost:8080)──▶  termux-bridge.js
        │                                         ├── POST /execute  → python/node/gcc/java (full project)
        │                                         ├── POST /sync     → write workspace
        └── iframe / new tab  ──GET /preview/*──▶ └── static file server
```

The bridge only listens on `127.0.0.1` (localhost), so nothing on your network can reach it.

## Prerequisites

1. **Install Termux** from [F-Droid](https://f-droid.org/en/packages/com.termux/) (do **not** use the
   Google Play version — it is outdated).
2. Open Termux and install **Node.js** (needed to run the bridge):
   ```
   pkg update && pkg upgrade
   pkg install nodejs
   ```

## Step-by-step

### 1. Install the languages you want to run

```
# Python
pkg install python

# Node.js (if not already)
pkg install nodejs

# C / C++ (clang provides gcc & g++)
pkg install clang

# Java
pkg install openjdk-17
```

### 2. Get the bridge script

Two options:

- **From CodeFlow:** Settings → Execution → **Copy Bridge Script**, then paste it into a file
  in Termux.
- **Manually:** copy `termux-bridge.js` from this project into Termux (e.g. via a file manager
  or by typing it in).

### 3. Create the file in Termux

```
nano termux-bridge.js
```

Paste the script, then save with `Ctrl+X`, `Y`, `Enter`.

### 4. Run the bridge

```
node termux-bridge.js
```

You should see:
```
CodeFlow Termux bridge running at http://127.0.0.1:8080
Keep this terminal open while using CodeFlow.
```

> Keep this Termux terminal **open** in the background while using CodeFlow.

### 5. Connect in CodeFlow

Go to **Settings → Execution → Termux Integration → Refresh**. The status should change to
**"Termux bridge connected"** (green).

## Using it

- JavaScript / TypeScript run in the browser unless the project has sibling modules **and**
  Termux is connected (then Node resolves `require` / `import`).
- Other languages (Python, C, C++, Java, Bash, ...) run in **Termux when the bridge is running**.
  The whole project is synced first, so `from util import greet` works.
- HTML preview uses the Termux live server when the v2 bridge is running (Open in new tab
  is optional). Without Termux, CSS/JS are bundled into the iframe.
- If the bridge is not running, CodeFlow falls back to **Judge0** (if a key is configured) then to
  **mock output**.
- After a run, the terminal shows a colored badge: **"Ran in Termux"** (green),
  "Ran locally" (blue), "Ran on Judge0" (purple), or "Mock output" (gray).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Termux bridge not running" on Vercel (HTTPS) | You must open CodeFlow **on the phone** (not a PC). Copy the **latest** bridge from Settings, restart `node termux-bridge.js`, tap **Refresh**, and **Allow local network access** if Chrome prompts. Old bridge scripts reject Chrome’s private-network preflight. |
| "Termux bridge not running" | Make sure `node termux-bridge.js` is still running in Termux, then tap **Refresh**. |
| "Port 8080 in use" | Kill the old process: `pkill -f termux-bridge`, then run again. |
| "python3 is not installed" | The bridge message tells you the exact install command (e.g. `pkg install python`). |
| Bridge worked, then stopped | Restart it with `node termux-bridge.js`. CodeFlow auto-falls back to Judge0/mock meanwhile. |
| Executes but times out | Code is capped at 10 seconds in the bridge (adjustable in the script). |

## Security notes

- The bridge binds only to **127.0.0.1** — no external device or network can reach it.
- It **never runs arbitrary shell commands** — only the predefined language executors.
- Execution is sandboxed by Termux (no access to system files outside the Termux environment).
- **Do not** forward port 8080 or run this on public WiFi with port forwarding enabled.
