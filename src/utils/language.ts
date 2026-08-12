import { getExtension } from './path'

export type LanguageExecute = 'browser' | 'termux' | 'judge0' | 'preview' | 'none'

export interface LanguageProfile {
  key: string
  name: string
  judge0Id: number | null
  termuxKey: string | null
  execute: LanguageExecute
  /** Send sibling files so imports / packages resolve. */
  workspace: boolean
  /** Only these extensions are packed into a Termux workspace. */
  workspaceExts: string[]
}

const EXT_TO_LANG: Record<string, string> = {
  py: 'python',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  jsx: 'javascript',
  tsx: 'typescript',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  java: 'java',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'sass',
  less: 'less',
  json: 'json',
  md: 'markdown',
  go: 'go',
  rs: 'rust',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  sql: 'sql',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  vue: 'vue',
  lua: 'lua',
  r: 'r',
  scala: 'scala',
  dart: 'dart',
  pl: 'perl',
  pas: 'pascal',
  cs: 'csharp',
  fs: 'fsharp',
  ml: 'ocaml',
  clj: 'clojure',
  groovy: 'groovy',
  vb: 'vbnet',
  cobol: 'cobol',
  txt: 'text',
  svg: 'xml',
}

function profile(
  key: string,
  name: string,
  extra: Partial<LanguageProfile> = {},
): LanguageProfile {
  return {
    key,
    name,
    judge0Id: extra.judge0Id ?? null,
    termuxKey: extra.termuxKey ?? null,
    execute: extra.execute ?? 'none',
    workspace: extra.workspace ?? false,
    workspaceExts: extra.workspaceExts ?? [],
  }
}

/** Per-language run rules — keep this table the single source of truth. */
export const LANGUAGE_PROFILES: Record<string, LanguageProfile> = {
  python: profile('python', 'Python', {
    judge0Id: 92, termuxKey: 'python', execute: 'termux', workspace: true, workspaceExts: ['.py'],
  }),
  javascript: profile('javascript', 'JavaScript', {
    judge0Id: 93, termuxKey: 'javascript', execute: 'browser', workspace: true, workspaceExts: ['.js', '.mjs', '.cjs', '.json'],
  }),
  typescript: profile('typescript', 'TypeScript', {
    judge0Id: 94, termuxKey: 'typescript', execute: 'browser', workspace: true, workspaceExts: ['.ts', '.tsx', '.js', '.json'],
  }),
  c: profile('c', 'C', {
    judge0Id: 50, termuxKey: 'c', execute: 'termux', workspace: true, workspaceExts: ['.c', '.h'],
  }),
  cpp: profile('cpp', 'C++', {
    judge0Id: 54, termuxKey: 'cpp', execute: 'termux', workspace: true, workspaceExts: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
  }),
  java: profile('java', 'Java', {
    judge0Id: 91, termuxKey: 'java', execute: 'termux', workspace: true, workspaceExts: ['.java'],
  }),
  go: profile('go', 'Go', {
    judge0Id: 60, termuxKey: 'go', execute: 'termux', workspace: true, workspaceExts: ['.go'],
  }),
  rust: profile('rust', 'Rust', {
    judge0Id: 73, termuxKey: 'rust', execute: 'termux', workspace: false, workspaceExts: ['.rs'],
  }),
  ruby: profile('ruby', 'Ruby', {
    judge0Id: 72, termuxKey: 'ruby', execute: 'termux', workspace: true, workspaceExts: ['.rb'],
  }),
  php: profile('php', 'PHP', {
    judge0Id: 68, termuxKey: 'php', execute: 'termux', workspace: false, workspaceExts: ['.php'],
  }),
  swift: profile('swift', 'Swift', {
    judge0Id: 83, termuxKey: 'swift', execute: 'termux', workspace: false, workspaceExts: ['.swift'],
  }),
  kotlin: profile('kotlin', 'Kotlin', {
    judge0Id: 78, termuxKey: 'kotlin', execute: 'termux', workspace: false, workspaceExts: ['.kt'],
  }),
  shell: profile('shell', 'Bash', {
    judge0Id: 46, termuxKey: 'shell', execute: 'termux', workspace: false, workspaceExts: ['.sh'],
  }),
  lua: profile('lua', 'Lua', {
    judge0Id: 64, termuxKey: 'lua', execute: 'termux', workspace: false, workspaceExts: ['.lua'],
  }),
  perl: profile('perl', 'Perl', {
    judge0Id: 85, termuxKey: 'perl', execute: 'termux', workspace: false, workspaceExts: ['.pl'],
  }),
  r: profile('r', 'R', { judge0Id: 80, execute: 'judge0' }),
  scala: profile('scala', 'Scala', { judge0Id: 81, execute: 'judge0' }),
  dart: profile('dart', 'Dart', { judge0Id: 90, execute: 'judge0' }),
  pascal: profile('pascal', 'Pascal', { judge0Id: 67, execute: 'judge0' }),
  csharp: profile('csharp', 'C#', { judge0Id: 51, execute: 'judge0' }),
  fsharp: profile('fsharp', 'F#', { judge0Id: 87, execute: 'judge0' }),
  ocaml: profile('ocaml', 'OCaml', { judge0Id: 65, execute: 'judge0' }),
  clojure: profile('clojure', 'Clojure', { judge0Id: 86, execute: 'judge0' }),
  groovy: profile('groovy', 'Groovy', { judge0Id: 88, execute: 'judge0' }),
  vbnet: profile('vbnet', 'VB.NET', { judge0Id: 84, execute: 'judge0' }),
  cobol: profile('cobol', 'COBOL', { judge0Id: 77, execute: 'judge0' }),
  sql: profile('sql', 'SQL', { judge0Id: 82, execute: 'judge0' }),
  html: profile('html', 'HTML', { judge0Id: 12, execute: 'preview' }),
  css: profile('css', 'CSS', { judge0Id: 12, execute: 'preview' }),
  sass: profile('sass', 'Sass', { execute: 'preview' }),
  less: profile('less', 'Less', { execute: 'preview' }),
  vue: profile('vue', 'Vue', { execute: 'preview' }),
  markdown: profile('markdown', 'Markdown', { execute: 'preview' }),
  json: profile('json', 'JSON', { execute: 'none' }),
  yaml: profile('yaml', 'YAML', { execute: 'none' }),
  xml: profile('xml', 'XML', { execute: 'none' }),
  text: profile('text', 'Plain Text', { judge0Id: 43, execute: 'none' }),
  plain: profile('plain', 'Plain Text', { execute: 'none' }),
}

export function detectLanguage(path: string): string {
  const ext = getExtension(path)
  return EXT_TO_LANG[ext] || 'plain'
}

export function getLanguageProfile(langOrPath: string): LanguageProfile {
  const key = langOrPath.includes('.') || langOrPath.includes('/')
    ? detectLanguage(langOrPath)
    : langOrPath
  return LANGUAGE_PROFILES[key] || LANGUAGE_PROFILES.plain
}

export function languageName(lang: string): string {
  return getLanguageProfile(lang).name
}

export function judge0IdForLanguage(lang: string): number | null {
  return getLanguageProfile(lang).judge0Id
}

export function judge0IdForFile(path: string): number | null {
  return judge0IdForLanguage(detectLanguage(path))
}

export function canRunLocally(lang: string): boolean {
  return getLanguageProfile(lang).execute === 'browser'
}

/** True when the source likely blocks on scanf / input() / cin. */
export function usesInteractiveInput(code: string, lang: string): boolean {
  if (!code) return false
  if (lang === 'c' || lang === 'cpp') {
    return /\b(scanf|wscanf|getchar|getwchar|gets\s*\(|fgets\s*\(|fgetc\s*\(\s*stdin|cin\s*>>)\b/.test(code)
  }
  if (lang === 'python') return /(?<![.\w])input\s*\(/.test(code)
  if (lang === 'java') return /\bScanner\b|System\.in/.test(code)
  if (lang === 'ruby') return /\bgets\b|\bSTDIN\b/.test(code)
  if (lang === 'go') return /\bfmt\.Scan|\bbufio\.NewReader|\bos\.Stdin\b/.test(code)
  return false
}

const MAX_WORKSPACE_BYTES = 1_500_000
const MAX_WORKSPACE_FILES = 80

/** Keep only files this language can actually import — avoids shipping the whole project. */
export function filterWorkspaceFiles(
  files: Record<string, string> | undefined,
  lang: string,
  entryPath: string,
): Record<string, string> | undefined {
  const profile = getLanguageProfile(lang)
  if (!files || !profile.workspace) return undefined
  const allow = new Set(profile.workspaceExts.map((e) => e.toLowerCase()))
  const out: Record<string, string> = {}
  let bytes = 0
  let count = 0
  const entry = files[entryPath]
  if (typeof entry === 'string') {
    out[entryPath] = entry
    bytes += entry.length
    count++
  }
  for (const [p, content] of Object.entries(files)) {
    if (p === entryPath) continue
    if (typeof content !== 'string') continue
    const ext = p.includes('.') ? '.' + p.split('.').pop()!.toLowerCase() : ''
    if (!allow.has(ext)) continue
    if (count >= MAX_WORKSPACE_FILES) break
    if (bytes + content.length > MAX_WORKSPACE_BYTES) continue
    out[p] = content
    bytes += content.length
    count++
  }
  return Object.keys(out).length ? out : undefined
}
