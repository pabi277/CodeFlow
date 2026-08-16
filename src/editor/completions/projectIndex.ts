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
