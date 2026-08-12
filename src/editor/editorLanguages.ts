import type { Extension } from '@codemirror/state'

// Language packages are lazy-loaded via dynamic import so only the language of
// the file currently open is pulled into the bundle (per the performance spec).
// `loadLanguageExtension` returns a Promise resolving to the CodeMirror
// extension for the given logical language key.

type Loader = () => Promise<Extension>

const loaders: Record<string, Loader> = {
  python: () => import('@codemirror/lang-python').then((m) => m.python()),
  javascript: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ jsx: true })),
  typescript: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ jsx: true, typescript: true })),
  c: () => import('@codemirror/lang-cpp').then((m) => m.cpp()),
  cpp: () => import('@codemirror/lang-cpp').then((m) => m.cpp()),
  java: () => import('@codemirror/lang-java').then((m) => m.java()),
  html: () => import('@codemirror/lang-html').then((m) => m.html({ autoCloseTags: true })),
  css: () => import('@codemirror/lang-css').then((m) => m.css()),
  json: () => import('@codemirror/lang-json').then((m) => m.json()),
  markdown: () => import('@codemirror/lang-markdown').then((m) => m.markdown()),
  sql: () => import('@codemirror/lang-sql').then((m) => m.sql()),
  xml: () => import('@codemirror/lang-xml').then((m) => m.xml()),
  rust: () => import('@codemirror/lang-rust').then((m) => m.rust()),
  go: () => import('@codemirror/lang-go').then((m) => m.go()),
  php: () => import('@codemirror/lang-php').then((m) => m.php()),
  yaml: () => import('@codemirror/lang-yaml').then((m) => m.yaml()),
  vue: () => import('@codemirror/lang-vue').then((m) => m.vue()),
  sass: () => import('@codemirror/lang-sass').then((m) => m.sass({ indented: false })),
  less: () => import('@codemirror/lang-less').then((m) => m.less()),
  angular: () => import('@codemirror/lang-angular').then((m) => m.angular()),
}

const PLAIN: Extension = []

export async function loadLanguageExtension(lang: string): Promise<Extension> {
  const loader = loaders[lang]
  if (!loader) return PLAIN
  try {
    return await loader()
  } catch {
    return PLAIN
  }
}
