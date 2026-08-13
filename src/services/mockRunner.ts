// Local execution used as the default (no API key needed).
//
// JavaScript runs OFFLINE in a sandbox that cannot reach the app's own data:
//   - browser  → a hidden <iframe sandbox="allow-scripts"> (no allow-same-origin)
//                with stdout/stderr/stdin/result passed over postMessage. The
//                opaque origin blocks IndexedDB, localStorage, cookies, and the
//                parent page's DOM.
//   - node     → an isolated `node:vm` context (used by the test harness, which
//                has no DOM). It has no access to Node globals (fetch, process,
//                require, …) either.
//
// Every other language is NOT run here — the execution service returns an
// honest "cannot run" error instead of faking a successful result.

export interface MockRunResult {
  stdout: string
  stderr: string
  compileOutput: string
  status: 'accepted' | 'runtime_error' | 'compile_error'
  timeMs: number
  memoryKb: number
}

const RUN_LIMIT_MS = 5000

// ---------------------------------------------------------------------------
// Browser: sandboxed iframe
// ---------------------------------------------------------------------------

/** The static bootstrap that lives inside the sandboxed iframe. It talks to the
 *  parent only via postMessage and evaluates user code with a console shim. */
export const SANDBOX_IFRAME_SRCDOC = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
(function () {
  'use strict'
  function send(type, payload) {
    try { parent.postMessage({ __codeflow: true, type: type, payload: payload }, '*') } catch (e) {}
  }
  function fmt(args) {
    var out = []
    for (var i = 0; i < args.length; i++) {
      var a = args[i]
      try {
        if (typeof a === 'string') out.push(a)
        else if (a === undefined) out.push('undefined')
        else if (a === null) out.push('null')
        else if (typeof a === 'object') out.push(JSON.stringify(a) || String(a))
        else out.push(String(a))
      } catch (e) { out.push(String(a)) }
    }
    return out.join(' ')
  }
  var stdout = []
  var stderr = []
  var consoleShim = {
    log: function () { stdout.push(fmt(arguments)) },
    info: function () { stdout.push(fmt(arguments)) },
    debug: function () { stdout.push(fmt(arguments)) },
    warn: function () { stderr.push(fmt(arguments)) },
    error: function () { stderr.push(fmt(arguments)) },
  }
  var timers = []
  var stopped = false
  function wrappedTimeout(fn, ms) { var id = setTimeout(function () { if (!stopped) fn() }, ms); timers.push(id); return id }
  function wrappedInterval(fn, ms) { var id = setInterval(function () { if (!stopped) fn() }, ms); timers.push(id); return id }
  function wrappedClear(id) { clearTimeout(id); clearInterval(id) }
  var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

  function onMessage(ev) {
    var data = ev.data
    if (!data || data.__codeflow !== true || data.type !== 'run') return
    var start = Date.now()
    var finished = false
    function finish(status, err) {
      if (finished) return
      finished = true
      stopped = true
      for (var i = 0; i < timers.length; i++) { clearTimeout(timers[i]); clearInterval(timers[i]) }
      if (err) stderr.push(err)
      send('done', {
        status: status,
        stdout: stdout.join('\\n'),
        stderr: stderr.join('\\n'),
        timeMs: Date.now() - start,
      })
    }
    try {
      var fn = new AsyncFunction('console', 'stdin', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
        '"use strict";\\n' + data.code)
      Promise.resolve(fn(consoleShim, data.stdin, wrappedTimeout, wrappedInterval, wrappedClear, wrappedClear)).then(
        function (v) { if (v !== undefined) stdout.push(typeof v === 'string' ? v : String(v)); finish('accepted') },
        function (e) { finish('runtime_error', e && e.message ? e.message : String(e)) },
      )
    } catch (e) {
      finish('runtime_error', e && e.message ? e.message : String(e))
    }
  }
  window.addEventListener('message', onMessage, false)
  send('ready', {})
})()
</script>
</body>
</html>`

function isBrowser(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined'
}

function runInSandboxedIframe(code: string, stdin: string): Promise<MockRunResult> {
  return new Promise((resolve) => {
    const start = Date.now()
    const iframe = document.createElement('iframe')
    // allow-scripts WITHOUT allow-same-origin → an opaque origin that cannot
    // touch IndexedDB, localStorage, cookies, or the parent DOM.
    iframe.setAttribute('sandbox', 'allow-scripts')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'display:none;width:0;height:0;border:0;position:absolute;visibility:hidden'
    iframe.srcdoc = SANDBOX_IFRAME_SRCDOC

    let settled = false
    const finish = (result: MockRunResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      try { iframe.remove() } catch { /* ignore */ }
      resolve(result)
    }
    const timer = setTimeout(() => {
      finish({
        stdout: '',
        stderr: `Execution timed out after ${RUN_LIMIT_MS / 1000}s`,
        compileOutput: '',
        status: 'runtime_error',
        timeMs: Date.now() - start,
        memoryKb: 2048,
      })
    }, RUN_LIMIT_MS)

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { __codeflow?: boolean; type?: string; payload?: Record<string, unknown> } | null
      if (!data || data.__codeflow !== true) return
      // Only trust the window we spawned (never the page or other frames).
      if (event.source !== iframe.contentWindow) return
      if (data.type === 'ready') {
        iframe.contentWindow?.postMessage({ __codeflow: true, type: 'run', code, stdin }, '*')
        return
      }
      if (data.type === 'done' && data.payload) {
        const p = data.payload
        finish({
          stdout: String(p.stdout || ''),
          stderr: String(p.stderr || ''),
          compileOutput: '',
          status: p.status === 'accepted' ? 'accepted' : 'runtime_error',
          timeMs: Number(p.timeMs) || (Date.now() - start),
          memoryKb: 2048,
        })
      }
    }

    window.addEventListener('message', onMessage)
    document.body.appendChild(iframe)
  })
}

// ---------------------------------------------------------------------------
// Node: isolated vm context (test harness only — there is no DOM to sandbox)
// ---------------------------------------------------------------------------

async function runInNodeSandbox(code: string, stdin: string): Promise<MockRunResult> {
  const vm = await import(/* @vite-ignore */ 'node:vm')
  const start = Date.now()
  const stdout: string[] = []
  const stderr: string[] = []
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const fmt = (args: unknown[]) => args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' ')
  const sandboxConsole = {
    log: (...a: unknown[]) => stdout.push(fmt(a)),
    info: (...a: unknown[]) => stdout.push(fmt(a)),
    debug: (...a: unknown[]) => stdout.push(fmt(a)),
    warn: (...a: unknown[]) => stderr.push(fmt(a)),
    error: (...a: unknown[]) => stderr.push(fmt(a)),
  }
  const wrappedTimeout = (fn: TimerHandler, ms?: number, ...rest: unknown[]) => {
    const id = setTimeout(() => {
      timers.delete(id)
      if (typeof fn === 'function') (fn as (...a: unknown[]) => void)(...rest)
    }, ms)
    timers.add(id)
    return id
  }
  const wrappedInterval = (fn: TimerHandler, ms?: number, ...rest: unknown[]) => {
    const id = setInterval(() => {
      if (typeof fn === 'function') (fn as (...a: unknown[]) => void)(...rest)
    }, ms)
    timers.add(id)
    return id
  }
  const wrappedClear = (id: ReturnType<typeof setTimeout>) => {
    timers.delete(id)
    clearTimeout(id)
    clearInterval(id as unknown as ReturnType<typeof setInterval>)
  }

  // A fresh context exposes standard ECMAScript built-ins only — no fetch,
  // process, require, Buffer, localStorage, or any other host/Node global.
  const context = vm.createContext({
    console: sandboxConsole,
    stdin,
    setTimeout: wrappedTimeout,
    setInterval: wrappedInterval,
    clearTimeout: wrappedClear,
    clearInterval: wrappedClear,
  })

  try {
    const script = new vm.Script('(async () => { "use strict";\n' + code + '\n})()')
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Execution timed out after ${RUN_LIMIT_MS / 1000}s`)), RUN_LIMIT_MS)
    })
    const ret = await Promise.race([script.runInContext(context) as Promise<unknown>, timeout])
    if (ret !== undefined) stdout.push(typeof ret === 'string' ? ret : safeStringify(ret))
    return {
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
      compileOutput: '',
      status: 'accepted',
      timeMs: Date.now() - start,
      memoryKb: 2048,
    }
  } catch (err) {
    const message = (err as Error)?.message || String(err)
    return {
      stdout: stdout.join('\n'),
      stderr: stderr.length ? stderr.join('\n') : message,
      compileOutput: '',
      status: 'runtime_error',
      timeMs: Date.now() - start,
      memoryKb: 2048,
    }
  } finally {
    for (const id of timers) {
      clearTimeout(id)
      clearInterval(id as unknown as ReturnType<typeof setInterval>)
    }
  }
}

export async function runLocalJavaScript(code: string, stdin: string): Promise<MockRunResult> {
  if (isBrowser()) return runInSandboxedIframe(code, stdin)
  return runInNodeSandbox(code, stdin)
}

function safeStringify(v: unknown): string {
  try {
    if (typeof v === 'object') return JSON.stringify(v, null, 0) ?? String(v)
    return String(v)
  } catch {
    return String(v)
  }
}
