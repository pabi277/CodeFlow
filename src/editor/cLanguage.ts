// C11 / C17 / C23 language rules used by completions, outline, and diagnostics.
// Kept regex-based so it stays cheap on phones — not a full compiler.

import type { DiagnosticSeverity } from '../types'

export const C_KEYWORDS = [
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
  'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
  'inline', 'int', 'long', 'register', 'restrict', 'return', 'short',
  'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union',
  'unsigned', 'void', 'volatile', 'while',
  '_Alignas', '_Alignof', '_Atomic', '_Bool', '_Complex', '_Generic',
  '_Imaginary', '_Noreturn', '_Static_assert', '_Thread_local',
  // C23
  'alignas', 'alignof', 'bool', 'constexpr', 'false', 'nullptr', 'static_assert',
  'thread_local', 'true', 'typeof', 'typeof_unqual',
] as const

export const C_TYPES = [
  'int', 'char', 'float', 'double', 'void', 'long', 'short', 'signed', 'unsigned',
  'size_t', 'ptrdiff_t', 'ssize_t', 'wchar_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t',
  'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'intptr_t', 'uintptr_t',
  'FILE', 'time_t', 'clock_t', 'va_list', 'bool', '_Bool',
] as const

export const C_PREPROCESSOR = [
  'include', 'define', 'undef', 'ifdef', 'ifndef', 'if', 'elif', 'else', 'endif',
  'pragma', 'error', 'warning', 'line', 'defined',
] as const

export const C_STDLIB: { label: string; header: string }[] = [
  { label: 'printf', header: 'stdio.h' },
  { label: 'fprintf', header: 'stdio.h' },
  { label: 'sprintf', header: 'stdio.h' },
  { label: 'snprintf', header: 'stdio.h' },
  { label: 'scanf', header: 'stdio.h' },
  { label: 'fscanf', header: 'stdio.h' },
  { label: 'sscanf', header: 'stdio.h' },
  { label: 'puts', header: 'stdio.h' },
  { label: 'putchar', header: 'stdio.h' },
  { label: 'getchar', header: 'stdio.h' },
  { label: 'gets', header: 'stdio.h' },
  { label: 'fgets', header: 'stdio.h' },
  { label: 'fputs', header: 'stdio.h' },
  { label: 'fopen', header: 'stdio.h' },
  { label: 'fclose', header: 'stdio.h' },
  { label: 'fread', header: 'stdio.h' },
  { label: 'fwrite', header: 'stdio.h' },
  { label: 'fseek', header: 'stdio.h' },
  { label: 'ftell', header: 'stdio.h' },
  { label: 'rewind', header: 'stdio.h' },
  { label: 'feof', header: 'stdio.h' },
  { label: 'ferror', header: 'stdio.h' },
  { label: 'perror', header: 'stdio.h' },
  { label: 'fflush', header: 'stdio.h' },
  { label: 'stdin', header: 'stdio.h' },
  { label: 'stdout', header: 'stdio.h' },
  { label: 'stderr', header: 'stdio.h' },
  { label: 'EOF', header: 'stdio.h' },
  { label: 'NULL', header: 'stddef.h' },
  { label: 'malloc', header: 'stdlib.h' },
  { label: 'calloc', header: 'stdlib.h' },
  { label: 'realloc', header: 'stdlib.h' },
  { label: 'free', header: 'stdlib.h' },
  { label: 'exit', header: 'stdlib.h' },
  { label: 'abort', header: 'stdlib.h' },
  { label: 'atexit', header: 'stdlib.h' },
  { label: 'atoi', header: 'stdlib.h' },
  { label: 'atol', header: 'stdlib.h' },
  { label: 'atof', header: 'stdlib.h' },
  { label: 'strtol', header: 'stdlib.h' },
  { label: 'strtod', header: 'stdlib.h' },
  { label: 'rand', header: 'stdlib.h' },
  { label: 'srand', header: 'stdlib.h' },
  { label: 'qsort', header: 'stdlib.h' },
  { label: 'bsearch', header: 'stdlib.h' },
  { label: 'abs', header: 'stdlib.h' },
  { label: 'labs', header: 'stdlib.h' },
  { label: 'strlen', header: 'string.h' },
  { label: 'strcpy', header: 'string.h' },
  { label: 'strncpy', header: 'string.h' },
  { label: 'strcat', header: 'string.h' },
  { label: 'strncat', header: 'string.h' },
  { label: 'strcmp', header: 'string.h' },
  { label: 'strncmp', header: 'string.h' },
  { label: 'strchr', header: 'string.h' },
  { label: 'strrchr', header: 'string.h' },
  { label: 'strstr', header: 'string.h' },
  { label: 'strtok', header: 'string.h' },
  { label: 'memcpy', header: 'string.h' },
  { label: 'memmove', header: 'string.h' },
  { label: 'memset', header: 'string.h' },
  { label: 'memcmp', header: 'string.h' },
  { label: 'sin', header: 'math.h' },
  { label: 'cos', header: 'math.h' },
  { label: 'tan', header: 'math.h' },
  { label: 'asin', header: 'math.h' },
  { label: 'acos', header: 'math.h' },
  { label: 'atan', header: 'math.h' },
  { label: 'atan2', header: 'math.h' },
  { label: 'sqrt', header: 'math.h' },
  { label: 'pow', header: 'math.h' },
  { label: 'exp', header: 'math.h' },
  { label: 'log', header: 'math.h' },
  { label: 'log10', header: 'math.h' },
  { label: 'fabs', header: 'math.h' },
  { label: 'floor', header: 'math.h' },
  { label: 'ceil', header: 'math.h' },
  { label: 'fmod', header: 'math.h' },
  { label: 'isalpha', header: 'ctype.h' },
  { label: 'isdigit', header: 'ctype.h' },
  { label: 'isalnum', header: 'ctype.h' },
  { label: 'isspace', header: 'ctype.h' },
  { label: 'islower', header: 'ctype.h' },
  { label: 'isupper', header: 'ctype.h' },
  { label: 'tolower', header: 'ctype.h' },
  { label: 'toupper', header: 'ctype.h' },
  { label: 'time', header: 'time.h' },
  { label: 'clock', header: 'time.h' },
  { label: 'assert', header: 'assert.h' },
]

export const C_SYSTEM_HEADERS = [
  'stdio.h', 'stdlib.h', 'string.h', 'math.h', 'ctype.h', 'time.h',
  'stdbool.h', 'stdint.h', 'stddef.h', 'stdarg.h', 'assert.h', 'limits.h',
  'float.h', 'errno.h', 'locale.h', 'setjmp.h', 'signal.h', 'iso646.h',
  'wchar.h', 'wctype.h', 'complex.h', 'tgmath.h', 'inttypes.h', 'stdalign.h',
  'stdnoreturn.h', 'threads.h', 'stdatomic.h', 'uchar.h',
]

const C_KEYWORD_SET = new Set<string>(C_KEYWORDS)
const CONTROL = new Set(['if', 'for', 'while', 'switch', 'sizeof', 'return', '_Generic', '_Static_assert', 'static_assert'])

export interface CSymbol {
  name: string
  type: 'function' | 'class' | 'variable'
  line: number
  kind?: 'struct' | 'union' | 'enum' | 'typedef' | 'macro' | 'field' | 'function' | 'variable'
}

export function extractCSymbols(code: string): CSymbol[] {
  const lines = code.split('\n')
  if (lines.length > 10_000) return []
  const symbols: CSymbol[] = []
  const seen = new Set<string>()

  const push = (name: string, type: CSymbol['type'], line: number, kind?: CSymbol['kind']) => {
    if (!name || C_KEYWORD_SET.has(name) || name.length > 80) return
    const key = `${type}:${name}`
    if (seen.has(key)) return
    seen.add(key)
    symbols.push({ name, type, line, kind })
  }

  let inBlockComment = false
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    if (inBlockComment) {
      const end = line.indexOf('*/')
      if (end < 0) continue
      line = line.slice(end + 2)
      inBlockComment = false
    }
    const blockStart = line.indexOf('/*')
    if (blockStart >= 0 && !line.slice(0, blockStart).includes('//')) {
      const end = line.indexOf('*/', blockStart + 2)
      if (end < 0) {
        line = line.slice(0, blockStart)
        inBlockComment = true
      } else {
        line = line.slice(0, blockStart) + ' ' + line.slice(end + 2)
      }
    }
    const slash = line.indexOf('//')
    if (slash >= 0) line = line.slice(0, slash)
    const t = line.trim()
    if (!t) continue

    const def = t.match(/^#\s*define\s+([A-Za-z_]\w*)/)
    if (def) {
      push(def[1], 'variable', i + 1, 'macro')
      continue
    }
    if (t.startsWith('#')) continue

    const tagged = t.match(/\b(struct|union|enum)\s+([A-Za-z_]\w*)/)
    if (tagged) push(tagged[2], 'class', i + 1, tagged[1] as CSymbol['kind'])

    const td = t.match(/\btypedef\s+(?:struct|union|enum)\s+(?:[A-Za-z_]\w*\s+)?(?:\{[^}]*\}\s*)?([A-Za-z_]\w*)\s*;/)
    if (td) push(td[1], 'class', i + 1, 'typedef')
    const tdSimple = t.match(/\btypedef\s+[A-Za-z_]\w*(?:\s+\*+|\s+const|\s+volatile)*\s+([A-Za-z_]\w*)\s*;/)
    if (tdSimple) push(tdSimple[1], 'class', i + 1, 'typedef')

    const field = t.match(/^\s*(?:(?:const|volatile|unsigned|signed|long|short|struct|enum|union)\s+)*[A-Za-z_]\w*(?:\s+\*+)?\s+([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*;/)
    if (field && !t.includes('(')) push(field[1], 'variable', i + 1, 'field')

    const fn = t.match(
      /^(?:(?:static|extern|inline|_Noreturn|const|unsigned|signed|long|short|struct|enum|union|volatile|restrict)\s+)*[A-Za-z_]\w*(?:\s+\*+)+\s*([A-Za-z_]\w*)\s*\(|^(?:(?:static|extern|inline|_Noreturn|const|unsigned|signed|long|short|struct|enum|union|volatile|restrict)\s+)*[A-Za-z_]\w*\s+([A-Za-z_]\w*)\s*\(/,
    )
    if (fn) {
      const name = fn[1] || fn[2]
      if (name && !CONTROL.has(name)) push(name, 'function', i + 1, 'function')
    }

    const decl = t.match(
      /^(?:(?:static|extern|const|volatile|unsigned|signed|long|short|auto|register|struct|enum)\s+)*[A-Za-z_]\w*(?:\s+\*+)?\s+([A-Za-z_]\w*)\s*(?:=|,|;|\[)/,
    )
    if (decl && !t.includes('(')) push(decl[1], 'variable', i + 1, 'variable')
  }

  return symbols
}

export interface CDraft {
  line: number
  col: number
  severity: DiagnosticSeverity
  message: string
  source: string
}

const TYPE_START = /^(?:(?:static|extern|inline|const|volatile|unsigned|signed|long|short|auto|register|struct|enum|union|typedef|_Thread_local|thread_local)\s+)+\S|\b(?:int|char|float|double|void|bool|_Bool|size_t|FILE)\b/

/** Extra C checks: preprocessor balance, missing semicolons, empty statements. */
export function diagnoseC(src: string): CDraft[] {
  const drafts: CDraft[] = []
  const lines = src.split('\n')
  let pp = 0
  let ppLine = 1
  let inBlock = false

  for (let i = 0; i < lines.length; i++) {
    let raw = lines[i]
    if (inBlock) {
      const end = raw.indexOf('*/')
      if (end < 0) continue
      raw = raw.slice(end + 2)
      inBlock = false
    }
    const bs = raw.indexOf('/*')
    if (bs >= 0) {
      const end = raw.indexOf('*/', bs + 2)
      if (end < 0) {
        raw = raw.slice(0, bs)
        inBlock = true
      } else {
        raw = raw.slice(0, bs) + ' ' + raw.slice(end + 2)
      }
    }
    const sl = raw.indexOf('//')
    if (sl >= 0) raw = raw.slice(0, sl)
    const t = raw.trim()
    if (!t) continue

    const dir = t.match(/^#\s*(\w+)/)
    if (dir) {
      const d = dir[1]
      if (d === 'if' || d === 'ifdef' || d === 'ifndef') {
        if (pp === 0) ppLine = i + 1
        pp++
      } else if (d === 'endif') {
        pp--
        if (pp < 0) {
          drafts.push({ line: i + 1, col: 1, severity: 'error', message: 'Unmatched #endif', source: 'c' })
          pp = 0
        }
      }
      if (d === 'include' && !/^\s*#\s*include\s*[<"][^>"]+[>"]/.test(t)) {
        drafts.push({ line: i + 1, col: 1, severity: 'error', message: '#include needs <header.h> or "header.h"', source: 'c' })
      }
      continue
    }

    if (/^@(?:interface|end|implementation|property)/.test(t)) continue

    const needsSemi = looksLikeCStatement(t)
    if (needsSemi && !/;\s*$/.test(t) && !/[{,]\s*$/.test(t)) {
      drafts.push({
        line: i + 1,
        col: Math.max(1, raw.length),
        severity: 'warning',
        message: 'Statement may be missing a semicolon',
        source: 'c-semicolon',
      })
    }
  }

  if (pp > 0) {
    drafts.push({ line: ppLine, col: 1, severity: 'error', message: 'Unclosed #if / #ifdef / #ifndef', source: 'c' })
  }
  return drafts.slice(0, 40)
}

function looksLikeCStatement(t: string): boolean {
  if (/[{}:]\s*$/.test(t)) return false
  if (/^\s*(if|else|for|while|do|switch|case|default|struct|union|enum|typedef)\b/.test(t)) return false
  if (/\)\s*$/.test(t) && TYPE_START.test(t) && t.includes('(')) {
    // function definition header — body on next line
    return false
  }
  if (/^(return|break|continue|goto)\b/.test(t)) return true
  if (/^(printf|scanf|fprintf|sprintf|snprintf|puts|putchar|malloc|free|exit|memcpy|memset|strcpy|strlen)\s*\(/.test(t)) return true
  if (/^[A-Za-z_]\w*\s*\([^;]*\)\s*$/.test(t) && !TYPE_START.test(t)) return true
  if (/^[A-Za-z_].*=/.test(t) && !t.endsWith('{')) return true
  if (TYPE_START.test(t) && !t.includes('(') && /[A-Za-z_]\w*\s*$/.test(t)) return true
  return false
}

export function isCIdent(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !C_KEYWORD_SET.has(name)
}
