// Unified execution service with a per-language priority chain:
//   preview/none -> short message (never hit Termux)
//   JS/TS        -> browser sandbox, unless sibling modules + Termux
//   termux langs -> Termux (filtered workspace) -> Judge0 -> mock
//   judge0 langs -> Judge0 -> mock
import { runLocalJavaScript, mockSample } from './mockRunner'
import * as judge0 from './judge0Service'
import {
  judge0IdForLanguage,
  canRunLocally,
  languageName,
  detectLanguage,
  getLanguageProfile,
  filterWorkspaceFiles,
  usesInteractiveInput,
} from '../utils/language'
import { getBridgeOrigin, setBridgeOrigin, normalizeBridgeOrigin } from './bridgeUrl'
import type { ExecStatus } from '../types'

export type ExecutionSource = 'local' | 'termux' | 'judge0' | 'mock'

export interface ExecuteResult {
  success: boolean
  stdout: string
  stderr: string
  compileOutput: string
  status: ExecStatus
  executionTime: number
  memoryKb: number
  source: ExecutionSource
  error?: string
  sessionId?: string
  interactive?: boolean
  done?: boolean
}

const MAX_STREAM_CHARS = 48_000
const FETCH_TIMEOUT_MS = 18_000

export function clipOutput(text: string, max = MAX_STREAM_CHARS): string {
  if (!text || text.length <= max) return text || ''
  return text.slice(0, max) + `\n…[truncated ${text.length - max} chars]…`
}

let bridgeCache = { available: false, checkedAt: 0 }
let bridgeError: string | null = null

export function getBridgeError(): string | null {
  return bridgeError
}

function explainBridgeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || '')
  const httpsPage = typeof location !== 'undefined' && location.protocol === 'https:'
  if (/abort|timeout/i.test(msg)) {
    return 'No answer from the bridge (timeout). In Termux run: node termux-bridge.js'
  }
  if (httpsPage) {
    return 'This HTTPS site could not reach http://127.0.0.1:8080. On your phone: keep Termux running the new bridge script, tap Refresh, and Allow local network access if Chrome asks. Desktop browsers cannot reach Termux on the phone.'
  }
  return 'Termux bridge not reachable. Run: node termux-bridge.js'
}

async function probeOrigin(origin: string): Promise<boolean> {
  const res = await fetch(`${origin}/health`, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    signal: AbortSignal.timeout(2500),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json().catch(() => null)
  return !!(data && data.status === 'ok')
}

export async function checkTermuxBridge(force = false): Promise<boolean> {
  if (!force && Date.now() - bridgeCache.checkedAt < 8000) return bridgeCache.available
  const seen = new Set<string>()
  const candidates = [getBridgeOrigin(), 'http://127.0.0.1:8080', 'http://localhost:8080']
    .map(normalizeBridgeOrigin)
    .filter((o) => {
      if (seen.has(o)) return false
      seen.add(o)
      return true
    })

  let last = ''
  for (const origin of candidates) {
    try {
      if (await probeOrigin(origin)) {
        setBridgeOrigin(origin)
        bridgeError = null
        bridgeCache = { available: true, checkedAt: Date.now() }
        return true
      }
    } catch (err) {
      last = explainBridgeError(err)
    }
  }
  bridgeError = last || 'Termux bridge not running'
  bridgeCache = { available: false, checkedAt: Date.now() }
  return false
}

export function clearBridgeCache() {
  bridgeCache = { available: false, checkedAt: 0 }
}

function emptyResult(partial: Partial<ExecuteResult> & Pick<ExecuteResult, 'source' | 'status'>): ExecuteResult {
  return {
    success: false,
    stdout: '',
    stderr: '',
    compileOutput: '',
    executionTime: 0,
    memoryKb: 0,
    ...partial,
  }
}

export async function executeInTermux(
  code: string,
  language: string,
  stdin = '',
  files?: Record<string, string>,
  entry?: string,
  interactive = false,
): Promise<ExecuteResult> {
  const profile = getLanguageProfile(language)
  const key = profile.termuxKey
  if (!key) throw new Error(`Termux does not support ${languageName(language)}.`)
  const packed = filterWorkspaceFiles(files, language, entry || '')
  const t0 = Date.now()
  let res: Response
  try {
    res = await fetch(`${getBridgeOrigin()}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: key, code, stdin, files: packed, entry, interactive }),
      signal: AbortSignal.timeout(interactive ? 45_000 : FETCH_TIMEOUT_MS),
    })
  } catch {
    clearBridgeCache()
    throw new Error('Termux bridge disconnected. Restart it with: node termux-bridge.js')
  }

  let data: Record<string, unknown>
  try {
    data = await res.json()
  } catch {
    return emptyResult({
      source: 'termux',
      status: 'system_error',
      stderr: 'Termux returned an invalid response.',
      executionTime: Date.now() - t0,
    })
  }

  const elapsed = Date.now() - t0
  const stdout = clipOutput(String(data.stdout || ''))
  const stderr = clipOutput(String(data.stderr || data.error || ''))
  const errMsg = typeof data.error === 'string' ? data.error : undefined

  if (data.error && !data.success && !data.stdout && !data.stderr) {
    return {
      success: false, stdout: '', stderr: '', compileOutput: clipOutput(String(data.error)),
      status: 'compile_error', executionTime: elapsed, memoryKb: 0, source: 'termux', error: errMsg,
    }
  }

  let status: ExecStatus = data.success ? 'accepted' : 'runtime_error'
  if (data.compileError) status = 'compile_error'
  if (data.timedOut) status = 'time_limit_exceeded'

  return {
    success: !!data.success,
    stdout,
    stderr,
    compileOutput: data.compileError ? stderr : '',
    status: data.sessionId && !data.done ? 'accepted' : status,
    executionTime: Number(data.executionTime) || elapsed,
    memoryKb: 0,
    source: 'termux',
    error: errMsg,
    sessionId: typeof data.sessionId === 'string' ? data.sessionId : undefined,
    interactive: !!data.interactive,
    done: data.done !== false,
  }
}

export async function pollTermuxSession(sessionId: string): Promise<ExecuteResult> {
  const res = await fetch(`${getBridgeOrigin()}/poll?session=${encodeURIComponent(sessionId)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(4000),
  })
  const data = await res.json().catch(() => ({}))
  return {
    success: !!data.success,
    stdout: clipOutput(String(data.stdout || '')),
    stderr: clipOutput(String(data.stderr || data.error || '')),
    compileOutput: '',
    status: data.timedOut ? 'time_limit_exceeded' : data.done ? (data.success ? 'accepted' : 'runtime_error') : 'accepted',
    executionTime: Number(data.executionTime) || 0,
    memoryKb: 0,
    source: 'termux',
    sessionId,
    interactive: true,
    done: !!data.done || res.status === 404,
  }
}

export async function writeTermuxStdin(sessionId: string, text: string): Promise<ExecuteResult> {
  const res = await fetch(`${getBridgeOrigin()}/stdin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, text }),
    signal: AbortSignal.timeout(4000),
  })
  const data = await res.json().catch(() => ({}))
  return {
    success: res.ok,
    stdout: clipOutput(String(data.stdout || '')),
    stderr: clipOutput(String(data.stderr || data.error || '')),
    compileOutput: '',
    status: 'accepted',
    executionTime: 0,
    memoryKb: 0,
    source: 'termux',
    sessionId,
    interactive: true,
    done: !!data.done,
  }
}

export async function killTermuxSession(sessionId: string): Promise<void> {
  try {
    await fetch(`${getBridgeOrigin()}/kill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
      signal: AbortSignal.timeout(3000),
    })
  } catch { /* ignore */ }
}

export interface RunOptions {
  apiKey: string
  baseUrl: string
  timeLimit: number
  memoryLimit: number
}

function previewHint(lang: string): ExecuteResult {
  return {
    success: true,
    stdout: `${languageName(lang)} is a preview language — use the Preview button (eye icon) instead of Run.`,
    stderr: '',
    compileOutput: '',
    status: 'accepted',
    executionTime: 0,
    memoryKb: 0,
    source: 'local',
  }
}

function noneHint(lang: string): ExecuteResult {
  return {
    success: true,
    stdout: `${languageName(lang)} files are not executable. Open a Python, JS, C, Java, … file and press Run.`,
    stderr: '',
    compileOutput: '',
    status: 'accepted',
    executionTime: 0,
    memoryKb: 0,
    source: 'local',
  }
}

/** Full priority-chain execution. Failures never throw unless the bridge drops. */
export async function executeCode(
  code: string,
  path: string,
  stdin: string,
  opts: RunOptions,
  files?: Record<string, string>,
): Promise<ExecuteResult> {
  const lang = detectLanguage(path)
  const profile = getLanguageProfile(lang)

  if (profile.execute === 'preview') return previewHint(lang)
  if (profile.execute === 'none') return noneHint(lang)

  if (usesInteractiveInput(code, lang) && !stdin.trim() && !(await checkTermuxBridge())) {
    return {
      success: false,
      stdout: '',
      stderr: 'This program waits for scanf / input(). Open Terminal → Input and type each answer on its own line (for your stack menu: 1 then a number, then 7 to exit), then Run again. Or connect Termux to type live while it runs.',
      compileOutput: '',
      status: 'runtime_error',
      executionTime: 0,
      memoryKb: 0,
      source: 'local',
    }
  }

  const packed = filterWorkspaceFiles(files, lang, path)
  const siblingCount = packed ? Object.keys(packed).length : 0
  const wantsWorkspace = profile.workspace && siblingCount > 1

  if (canRunLocally(lang) && !(wantsWorkspace && await checkTermuxBridge())) {
    const r = await runLocalJavaScript(code, stdin)
    return {
      success: r.status === 'accepted',
      stdout: clipOutput(r.stdout),
      stderr: clipOutput(r.stderr),
      compileOutput: r.compileOutput,
      status: r.status,
      executionTime: r.timeMs,
      memoryKb: r.memoryKb,
      source: 'local',
    }
  }

  if (profile.termuxKey && await checkTermuxBridge()) {
    try {
      const r = await executeInTermux(code, lang, stdin, packed, path, usesInteractiveInput(code, lang))
      // Failed Termux runs still return a result — UI must stay responsive.
      return {
        ...r,
        stdout: clipOutput(r.stdout),
        stderr: clipOutput(r.stderr),
        compileOutput: clipOutput(r.compileOutput),
        success: !!r.success,
      }
    } catch (err) {
      void err
      if (canRunLocally(lang)) {
        const r = await runLocalJavaScript(code, stdin)
        return {
          success: r.status === 'accepted',
          stdout: clipOutput(r.stdout), stderr: clipOutput(r.stderr), compileOutput: r.compileOutput,
          status: r.status, executionTime: r.timeMs, memoryKb: r.memoryKb, source: 'local',
        }
      }
      // Fall through to Judge0 / mock instead of hanging the UI.
    }
  }

  const judge0Id = judge0IdForLanguage(lang)
  if (judge0Id && opts.apiKey) {
    const token = await judge0.submitCode(code, judge0Id, stdin, {
      apiKey: opts.apiKey, baseUrl: opts.baseUrl,
      timeLimit: opts.timeLimit, memoryLimit: opts.memoryLimit,
    })
    const result = await judge0.pollResult(token, opts.apiKey, opts.baseUrl)
    return {
      success: result.status?.id === 3,
      stdout: clipOutput(result.stdout || ''),
      stderr: clipOutput(result.stderr || ''),
      compileOutput: clipOutput(result.compile_output || ''),
      status: judge0Status(result.status?.id),
      executionTime: parseFloat(result.time || '0') * 1000,
      memoryKb: result.memory || 0,
      source: 'judge0',
    }
  }

  const m = mockSample(languageName(lang), code)
  return {
    success: true, stdout: m.stdout, stderr: m.stderr, compileOutput: m.compileOutput,
    status: m.status, executionTime: m.timeMs, memoryKb: m.memoryKb, source: 'mock',
  }
}

function judge0Status(id?: number): ExecStatus {
  switch (id) {
    case judge0.STATUS.ACCEPTED: return 'accepted'
    case judge0.STATUS.WRONG_ANSWER: return 'wrong_answer'
    case judge0.STATUS.TIME_LIMIT_EXCEEDED: return 'time_limit_exceeded'
    case judge0.STATUS.COMPILATION_ERROR: return 'compile_error'
    default:
      if (id && id >= judge0.STATUS.RUNTIME_ERROR_SIGSEGV && id <= judge0.STATUS.RUNTIME_ERROR_NZEC) return 'runtime_error'
      return 'system_error'
  }
}
