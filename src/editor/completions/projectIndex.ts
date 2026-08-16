import { detectLanguage } from '../../utils/language'
import { extractLocalSymbols, localSymbolsToEntries } from './localSymbols'
import type { CompletionEntry } from './keywords'

/** Lightweight project index shared by import-path and workspace-symbol completion. */
export interface IndexedFile {
  path: string
  name: string
  content?: string
}

let currentPath = ''
let files: IndexedFile[] = []
let symbolCacheKey = ''
let symbolCache: CompletionEntry[] = []

export function setProjectIndex(activePath: string, list: IndexedFile[]) {
  currentPath = activePath
  files = list
  symbolCacheKey = ''
}

export function getProjectIndex(): { currentPath: string; files: IndexedFile[] } {
  return { currentPath, files }
}

function normalizeProjectPath(path: string): string {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return '/' + parts.join('/')
}

function moduleFile(specifier: string): IndexedFile | undefined {
  const clean = specifier.replace(/^\.\//, '').replace(/\.(?:js|jsx|ts|tsx|py)$/, '')
  const currentDir = currentPath.slice(0, Math.max(0, currentPath.lastIndexOf('/') + 1))
  const wanted = normalizeProjectPath(currentDir + clean)
  return files.find((file) => {
    const noExt = file.path.replace(/\.(?:js|jsx|ts|tsx|py)$/, '')
    return noExt === wanted || noExt.endsWith(`/${clean}`) || noExt.endsWith(`/${clean}/index`)
  })
}

/** Symbols exposed through `import * as name` or `import module as name`. */
export function getImportedModuleMembers(receiver: string, language: string, activeCode: string): CompletionEntry[] {
  let specifier = ''
  if (language === 'javascript' || language === 'typescript') {
    const escaped = receiver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    specifier = activeCode.match(new RegExp(`import\\s+\\*\\s+as\\s+${escaped}\\s+from\\s+['"]([^'"]+)['"]`))?.[1] || ''
  } else if (language === 'python') {
    const escaped = receiver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    specifier = activeCode.match(new RegExp(`^\\s*import\\s+([\\w.]+)\\s+as\\s+${escaped}\\b`, 'm'))?.[1]
      || (activeCode.match(new RegExp(`^\\s*import\\s+${escaped}\\b`, 'm')) ? receiver : '')
  }
  const target = specifier ? moduleFile(specifier.replace(/\./g, '/')) : undefined
  if (!target?.content) return []
  return localSymbolsToEntries(extractLocalSymbols(target.content, language))
    .filter((entry) => entry.type === 'function' || entry.type === 'type' || !entry.label.startsWith('_'))
    .map((entry) => ({ ...entry, detail: `${entry.detail || entry.type} · ${target.name}`, origin: 'project' }))
}

/** Small same-language source bundle used for cross-file C/C++ type lookup. */
export function getProjectLanguageSource(language: string, maxChars = 300_000): string {
  let size = 0
  const chunks: string[] = []
  for (const file of files) {
    if (file.path === currentPath || detectLanguage(file.path) !== language || !file.content) continue
    if (size + file.content.length > maxChars) break
    chunks.push(file.content)
    size += file.content.length
  }
  return chunks.join('\n')
}

/**
 * Return symbols from sibling files of the same language. The limits keep this
 * cheap enough for phones while still making small projects feel IDE-like.
 */
export function getProjectSymbols(language: string): CompletionEntry[] {
  const candidates = files
    .filter((file) => file.path !== currentPath && detectLanguage(file.path) === language && typeof file.content === 'string')
    .slice(0, 80)
  const cacheKey = `${language}:${currentPath}:${candidates.map((f) => `${f.path}:${f.content!.length}`).join('|')}`
  if (cacheKey === symbolCacheKey) return symbolCache

  const result: CompletionEntry[] = []
  const seen = new Set<string>()
  let chars = 0
  for (const file of candidates) {
    chars += file.content!.length
    if (chars > 1_000_000) break
    const symbols = extractLocalSymbols(file.content!, language)
      .filter((symbol) => symbol.kind !== 'import' && symbol.kind !== 'parameter')
    for (const entry of localSymbolsToEntries(symbols)) {
      if (seen.has(entry.label)) continue
      seen.add(entry.label)
      result.push({ ...entry, detail: file.name, origin: 'project' })
      if (result.length >= 300) break
    }
    if (result.length >= 300) break
  }

  symbolCacheKey = cacheKey
  symbolCache = result
  return result
}
