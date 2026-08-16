// Language keyword / builtin / common-API completion lists.
import { C_KEYWORDS as C_KW, C_TYPES, C_PREPROCESSOR, C_STDLIB } from '../cLanguage'

export interface CompletionEntry {
  label: string
  type: 'keyword' | 'function' | 'type' | 'constant' | 'member' | 'variable'
  detail?: string
  info?: string
  origin?: 'local' | 'project' | 'language'
}

export const PYTHON_KEYWORDS: CompletionEntry[] = [
  'if', 'else', 'elif', 'for', 'while', 'def', 'class', 'import', 'from', 'return',
  'yield', 'try', 'except', 'finally', 'with', 'as', 'pass', 'break', 'continue',
  'lambda', 'global', 'nonlocal', 'async', 'await', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is',
].map((k) => ({ label: k, type: 'keyword' } as CompletionEntry))

export const PYTHON_BUILTINS: CompletionEntry[] = [
  'print', 'input', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple',
  'open', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'min', 'max', 'sum', 'abs', 'all',
  'any', 'isinstance', 'type', 'dir', 'help', 'reversed', 'round', 'bool', 'bytes', 'object',
].map((f) => ({ label: f, type: 'function' } as CompletionEntry))

export const PYTHON_MODULES = ['os', 'sys', 'math', 'random', 'json', 'datetime', 're', 'time', 'pathlib', 'collections', 'itertools', 'functools', 'typing', 'numpy', 'pandas'].map((m) => ({ label: m, type: 'variable', detail: 'module' } as CompletionEntry))

export const JS_KEYWORDS: CompletionEntry[] = [
  'function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'switch', 'case', 'break',
  'continue', 'return', 'class', 'extends', 'import', 'export', 'default', 'async', 'await',
  'try', 'catch', 'finally', 'throw', 'new', 'this', 'typeof', 'instanceof', 'delete', 'void',
  'yield', 'do', 'of', 'in', 'null', 'undefined', 'true', 'false',
].map((k) => ({ label: k, type: 'keyword' } as CompletionEntry))

export const JS_GLOBALS: CompletionEntry[] = [
  { label: 'console', type: 'variable', detail: 'global' },
  ...['Array', 'Object', 'String', 'Number', 'Math', 'Date', 'Promise', 'JSON', 'RegExp', 'Map', 'Set'].map((t) => ({ label: t, type: 'type' } as CompletionEntry)),
  ...['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'fetch', 'parseInt', 'parseFloat', 'isNaN', 'encodeURI', 'decodeURI'].map((f) => ({ label: f, type: 'function' } as CompletionEntry)),
]

export const JS_OBJECT_MEMBERS: CompletionEntry[] = [
  { label: 'log', type: 'member', detail: 'console' },
  { label: 'error', type: 'member', detail: 'console' },
  { label: 'warn', type: 'member', detail: 'console' },
  { label: 'parse', type: 'member', detail: 'JSON' },
  { label: 'stringify', type: 'member', detail: 'JSON' },
  { label: 'length', type: 'member' },
  { label: 'map', type: 'member' },
  { label: 'filter', type: 'member' },
  { label: 'reduce', type: 'member' },
  { label: 'forEach', type: 'member' },
  { label: 'push', type: 'member' },
  { label: 'pop', type: 'member' },
  { label: 'shift', type: 'member' },
  { label: 'unshift', type: 'member' },
  { label: 'slice', type: 'member' },
  { label: 'splice', type: 'member' },
  { label: 'concat', type: 'member' },
  { label: 'join', type: 'member' },
  { label: 'split', type: 'member' },
  { label: 'indexOf', type: 'member' },
  { label: 'includes', type: 'member' },
  { label: 'toUpperCase', type: 'member' },
  { label: 'toLowerCase', type: 'member' },
  { label: 'trim', type: 'member' },
  { label: 'floor', type: 'member', detail: 'Math' },
  { label: 'ceil', type: 'member', detail: 'Math' },
  { label: 'round', type: 'member', detail: 'Math' },
  { label: 'random', type: 'member', detail: 'Math' },
  { label: 'abs', type: 'member', detail: 'Math' },
  { label: 'max', type: 'member', detail: 'Math' },
  { label: 'min', type: 'member', detail: 'Math' },
  { label: 'now', type: 'member', detail: 'Date' },
  { label: 'then', type: 'member', detail: 'Promise' },
  { label: 'catch', type: 'member', detail: 'Promise' },
  { label: 'finally', type: 'member', detail: 'Promise' },
]

export const C_KEYWORDS: CompletionEntry[] = [
  ...C_KW.map((k) => ({ label: k, type: 'keyword' as const })),
  ...C_TYPES.map((t) => ({ label: t, type: 'type' as const, detail: 'C type' })),
  ...C_PREPROCESSOR.map((p) => ({ label: p, type: 'keyword' as const, detail: 'preprocessor' })),
]

export const C_FUNCTIONS: CompletionEntry[] = C_STDLIB.map((f) => ({
  label: f.label,
  type: f.label === f.label.toUpperCase() ? 'constant' : 'function',
  detail: f.header,
} as CompletionEntry))

/** Completions after `.` or `->` in C (common libc / struct fields). */
export const C_MEMBERS: CompletionEntry[] = [
  { label: 'next', type: 'member' },
  { label: 'prev', type: 'member' },
  { label: 'data', type: 'member' },
  { label: 'value', type: 'member' },
  { label: 'name', type: 'member' },
  { label: 'size', type: 'member' },
  { label: 'len', type: 'member' },
  { label: 'count', type: 'member' },
  { label: 'capacity', type: 'member' },
  { label: 'flags', type: 'member' },
  { label: 'type', type: 'member' },
  { label: 'id', type: 'member' },
  { label: 'x', type: 'member' },
  { label: 'y', type: 'member' },
  { label: 'key', type: 'member' },
  { label: 'left', type: 'member' },
  { label: 'right', type: 'member' },
  { label: 'parent', type: 'member' },
]

export const CPP_EXTRA: CompletionEntry[] = [
  'cout', 'cin', 'endl', 'string', 'vector', 'map', 'set', 'pair', 'auto', 'namespace', 'template',
  'class', 'public', 'private', 'protected', 'virtual', 'override', 'constexpr', 'nullptr', 'true', 'false',
].map((k) => ({ label: k, type: 'keyword' } as CompletionEntry))

export const JAVA_KEYWORDS: CompletionEntry[] = [
  'public', 'private', 'protected', 'static', 'final', 'void', 'int', 'long', 'double', 'float',
  'boolean', 'char', 'byte', 'short', 'String', 'class', 'interface', 'extends', 'implements',
  'new', 'this', 'super', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'return', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'abstract', 'enum',
  'null', 'true', 'false', 'var',
].map((k) => ({ label: k, type: 'keyword' } as CompletionEntry))

export const JAVA_APIS: CompletionEntry[] = [
  ...['System', 'ArrayList', 'HashMap', 'HashSet', 'List', 'Map', 'Set', 'String', 'Integer', 'Double', 'Math', 'Arrays', 'Collections', 'Scanner', 'Date', 'Optional', 'StringBuilder'].map((t) => ({ label: t, type: 'type' } as CompletionEntry)),
  { label: 'out', type: 'member', detail: 'System' },
  { label: 'println', type: 'member', detail: 'System.out' },
  { label: 'print', type: 'member', detail: 'System.out' },
  { label: 'format', type: 'member', detail: 'String.format' },
  { label: 'parseInt', type: 'function', detail: 'Integer' },
  { label: 'parseDouble', type: 'function', detail: 'Double' },
  { label: 'length', type: 'member' },
  { label: 'add', type: 'member', detail: 'List' },
  { label: 'get', type: 'member', detail: 'List' },
  { label: 'size', type: 'member', detail: 'Collection' },
  { label: 'put', type: 'member', detail: 'Map' },
]

function words(values: string, type: CompletionEntry['type'] = 'keyword', detail?: string): CompletionEntry[] {
  return values.split(/\s+/).filter(Boolean).map((label) => ({ label, type, detail, origin: 'language' }))
}

export const GO_ENTRIES: CompletionEntry[] = [
  ...words('break default func interface select case defer go map struct chan else goto package switch const fallthrough if range type continue for import return var'),
  ...words('bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint uint8 uint16 uint32 uint64 uintptr', 'type'),
  ...words('append cap close complex copy delete imag len make new panic print println real recover', 'function', 'builtin'),
  ...words('true false nil iota', 'constant'),
]

export const RUST_ENTRIES: CompletionEntry[] = [
  ...words('as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while'),
  ...words('bool char f32 f64 i8 i16 i32 i64 i128 isize str u8 u16 u32 u64 u128 usize String Vec Option Result Box', 'type'),
  ...words('Some None Ok Err', 'constant'),
  ...words('assert dbg drop format print println todo unreachable vec', 'function', 'macro'),
]

export const PHP_ENTRIES: CompletionEntry[] = [
  ...words('abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile eval exit extends final finally fn for foreach function global goto if implements include include_once instanceof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield'),
  ...words('bool int float string array object mixed void never iterable self parent', 'type'),
  ...words('null true false', 'constant'),
  ...words('count strlen array_map array_filter array_reduce json_encode json_decode explode implode trim in_array', 'function', 'PHP builtin'),
]

export const SHELL_ENTRIES: CompletionEntry[] = [
  ...words('if then else elif fi for while until do done case esac function in select time coproc'),
  ...words('echo printf read cd pwd export unset set shift source alias test trap wait', 'function', 'shell builtin'),
  ...words('HOME PATH PWD USER SHELL', 'variable', 'environment'),
]

export const SQL_ENTRIES: CompletionEntry[] = [
  ...words('SELECT FROM WHERE JOIN INNER LEFT RIGHT FULL OUTER ON AS INSERT INTO VALUES UPDATE SET DELETE CREATE ALTER DROP TABLE VIEW INDEX DISTINCT GROUP BY HAVING ORDER ASC DESC LIMIT OFFSET UNION ALL CASE WHEN THEN ELSE END WITH RECURSIVE PRIMARY KEY FOREIGN REFERENCES UNIQUE CHECK DEFAULT NULL NOT AND OR IN EXISTS BETWEEN LIKE IS'),
  ...words('INTEGER REAL TEXT BLOB BOOLEAN DATE DATETIME VARCHAR DECIMAL', 'type'),
  ...words('COUNT SUM AVG MIN MAX COALESCE NULLIF ROUND LOWER UPPER LENGTH SUBSTR', 'function', 'SQL function'),
  ...words('NULL TRUE FALSE CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP', 'constant'),
]

// Map logical language key -> combined keyword entries. Languages with native
// CodeMirror completion sources (HTML/CSS, for example) are composed with this
// list by Editor.tsx rather than replaced.
export const KEYWORDS_BY_LANG: Record<string, CompletionEntry[]> = {
  python: [...PYTHON_KEYWORDS, ...PYTHON_BUILTINS, ...PYTHON_MODULES],
  javascript: [...JS_KEYWORDS, ...JS_GLOBALS],
  typescript: [
    ...JS_KEYWORDS, ...JS_GLOBALS,
    ...words('interface type enum namespace declare abstract implements keyof readonly satisfies infer unknown never any', 'keyword'),
    ...words('string number boolean bigint symbol unknown never any void', 'type'),
  ],
  c: [...C_KEYWORDS, ...C_FUNCTIONS],
  cpp: [...C_KEYWORDS, ...C_FUNCTIONS, ...CPP_EXTRA],
  java: [...JAVA_KEYWORDS, ...JAVA_APIS],
  go: GO_ENTRIES,
  rust: RUST_ENTRIES,
  php: PHP_ENTRIES,
  shell: SHELL_ENTRIES,
  sql: SQL_ENTRIES,
}
