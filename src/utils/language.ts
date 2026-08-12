import { getExtension } from './path'

// Map of file extension -> logical language key
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

// Map logical language -> Judge0 language_id (most current / stable)
const LANG_TO_JUDGE0: Record<string, number> = {
  python: 92,
  javascript: 93,
  typescript: 94,
  c: 50,
  cpp: 54,
  java: 91,
  go: 60,
  rust: 73,
  ruby: 72,
  php: 68,
  swift: 83,
  kotlin: 78,
  shell: 46,
  sql: 82,
  html: 12,
  css: 12,
  lua: 64,
  r: 80,
  scala: 81,
  dart: 90,
  perl: 85,
  pascal: 67,
  csharp: 51,
  fsharp: 87,
  ocaml: 65,
  clojure: 86,
  groovy: 88,
  vbnet: 84,
  cobol: 77,
  text: 43,
}

export function detectLanguage(path: string): string {
  const ext = getExtension(path)
  return EXT_TO_LANG[ext] || 'plain'
}

export function languageName(lang: string): string {
  const names: Record<string, string> = {
    python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript',
    c: 'C', cpp: 'C++', java: 'Java', go: 'Go', rust: 'Rust', ruby: 'Ruby',
    php: 'PHP', swift: 'Swift', kotlin: 'Kotlin', shell: 'Bash', sql: 'SQL',
    html: 'HTML', css: 'CSS', json: 'JSON', markdown: 'Markdown', yaml: 'YAML',
    xml: 'XML', vue: 'Vue', lua: 'Lua', plain: 'Plain Text',
  }
  return names[lang] || lang
}

/** Judge0 id for a language key, or null if unsupported */
export function judge0IdForLanguage(lang: string): number | null {
  return LANG_TO_JUDGE0[lang] ?? null
}

export function judge0IdForFile(path: string): number | null {
  return judge0IdForLanguage(detectLanguage(path))
}

/** True if this language can be executed locally (mock/JS runner) */
export function canRunLocally(lang: string): boolean {
  return ['javascript', 'typescript'].includes(lang)
}
