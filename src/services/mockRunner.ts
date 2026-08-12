// Local execution used as the default (no API key needed).
// JavaScript/TypeScript are actually executed in a sandboxed async Function
// capturing console output. Other languages return a friendly mock result
// that points the user to Judge0 for real execution.

export interface MockRunResult {
  stdout: string
  stderr: string
  compileOutput: string
  status: 'accepted' | 'runtime_error' | 'compile_error'
  timeMs: number
  memoryKb: number
}

const RUN_LIMIT_MS = 5000

export async function runLocalJavaScript(code: string, stdin: string): Promise<MockRunResult> {
  const start = Date.now()
  const stdoutLines: string[] = []
  const stderrLines: string[] = []
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const capture = (stream: string[]) => (...args: unknown[]) => {
    stream.push(args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' '))
  }

  const sandboxConsole = {
    log: capture(stdoutLines),
    info: capture(stdoutLines),
    error: capture(stderrLines),
    warn: capture(stderrLines),
    debug: capture(stdoutLines),
  }

  // Browser execution is batch-based, just like Judge0 and Termux: all input
  // is entered before Run. Expose small familiar helpers so beginner-friendly
  // code such as `const name = input()` or `prompt()` works without opening a
  // browser-native dialog that appears to hang the editor.
  const inputLines = stdin.replace(/\r\n/g, '\n').split('\n')
  let inputIndex = 0
  const readInput = () => inputLines[inputIndex++] ?? ''

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

  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
    ...args: string[]
  ) => (...args: unknown[]) => Promise<unknown>
  const globalScope = globalThis as unknown as Record<string, unknown>
  const helperNames = ['input', 'readline', 'prompt'] as const
  const previousHelpers = helperNames.map((name) => ({
    name,
    existed: Object.prototype.hasOwnProperty.call(globalScope, name),
    value: globalScope[name],
  }))
  globalScope.input = readInput
  globalScope.readline = readInput
  globalScope.prompt = readInput
  let executionTimeout: ReturnType<typeof setTimeout> | null = null

  try {
    const fn = new AsyncFunction(
      'console',
      'stdin',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      '"use strict";\n' + code,
    )
    const run = Promise.resolve(
      fn(sandboxConsole, stdin, wrappedTimeout, wrappedInterval, wrappedClear, wrappedClear),
    )
    const timeout = new Promise<never>((_, reject) => {
      executionTimeout = setTimeout(() => reject(new Error(`Execution timed out after ${RUN_LIMIT_MS / 1000}s`)), RUN_LIMIT_MS)
    })
    const ret = await Promise.race([run, timeout])
    if (ret !== undefined && !(ret instanceof Promise)) stdoutLines.push(String(ret))
    else if (ret !== undefined) stdoutLines.push(String(await ret))
    return {
      stdout: stdoutLines.join('\n'),
      stderr: stderrLines.join('\n'),
      compileOutput: '',
      status: 'accepted',
      timeMs: Date.now() - start,
      memoryKb: 2048,
    }
  } catch (err: any) {
    const message = err?.message || String(err)
    const timedOut = /timed out/i.test(message)
    return {
      stdout: stdoutLines.join('\n'),
      stderr: stderrLines.length ? stderrLines.join('\n') : message,
      compileOutput: '',
      status: timedOut ? 'runtime_error' : 'runtime_error',
      timeMs: Date.now() - start,
      memoryKb: 2048,
    }
  } finally {
    if (executionTimeout !== null) clearTimeout(executionTimeout)
    for (const id of timers) {
      clearTimeout(id)
      clearInterval(id as unknown as ReturnType<typeof setInterval>)
    }
    for (const helper of previousHelpers) {
      if (helper.existed) globalScope[helper.name] = helper.value
      else delete globalScope[helper.name]
    }
  }
}

function safeStringify(v: unknown): string {
  try {
    if (typeof v === 'object') return JSON.stringify(v, null, 0) ?? String(v)
    return String(v)
  } catch {
    return String(v)
  }
}

/** Produce sample deterministic output so the terminal feels alive in mock mode. */
export function mockSample(languageName: string, code: string): MockRunResult {
  const firstLine = code.split('\n').find((l) => l.trim().length > 0) || ''
  const stdout = `[mock] ${languageName} execution sample.\n\nTo run "${languageName}" for real, add your Judge0 API key in Settings → Execution.\n\nFirst line of source:\n  ${firstLine}`
  return { stdout, stderr: '', compileOutput: '', status: 'accepted', timeMs: 1, memoryKb: 1024 }
}
