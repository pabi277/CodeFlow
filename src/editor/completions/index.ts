import type { CompletionContext, Completion, CompletionResult } from '@codemirror/autocomplete'
import { C_SYSTEM_HEADERS } from '../cLanguage'
import { KEYWORDS_BY_LANG, JS_OBJECT_MEMBERS, C_MEMBERS, type CompletionEntry } from './keywords'
import { TEMPLATE_COMPLETIONS_BY_LANG } from './keywordCompletions'
import { extractLocalSymbols, localSymbolsToEntries } from './localSymbols'
import { getProjectIndex, getProjectSymbols } from './projectIndex'
import { matchImportContext, suggestImportPaths } from '../../utils/importPaths'

const TYPE_BOOST: Record<string, number> = {
  variable: 8, function: 7, class: 7, type: 6, constant: 5, member: 5, keyword: 1,
}

const keywordCache = new Map<string, Completion[]>()
function keywordsFor(language: string): Completion[] {
  let list = keywordCache.get(language)
  if (list) return list
  list = (KEYWORDS_BY_LANG[language] || []).map((entry) => completionFromEntry(entry, 'Language', TYPE_BOOST[entry.type] || 1))
  keywordCache.set(language, list)
  return list
}

function completionFromEntry(entry: CompletionEntry, section: string, boost: number): Completion {
  return {
    label: entry.label,
    type: entry.type === 'member' ? 'property' : entry.type,
    detail: entry.detail,
    info: entry.info || (entry.detail ? `${entry.label} — ${entry.detail}` : undefined),
    boost,
    section,
    commitCharacters: entry.type === 'function' ? ['('] : undefined,
  }
}

function unique(options: Completion[]): Completion[] {
  const seen = new Set<string>()
  return options.filter((option) => {
    const key = `${option.label}:${option.type || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function cHeaderCompletion(context: CompletionContext, language: string): CompletionResult | null {
  if (language !== 'c' && language !== 'cpp') return null
  const line = context.state.doc.lineAt(context.pos)
  const before = line.text.slice(0, context.pos - line.from)
  const system = before.match(/^\s*#\s*include\s*<([^>]*)$/)
  if (system) {
    return {
      from: context.pos - system[1].length,
      options: C_SYSTEM_HEADERS.map((header) => ({
        label: header,
        type: 'text',
        detail: 'C standard header',
        apply: `${header}>`,
        boost: 5,
      })),
      validFor: /^[\w./-]*$/,
    }
  }
  const local = before.match(/^\s*#\s*include\s*"([^"]*)$/)
  if (!local) return null
  const { currentPath, files } = getProjectIndex()
  const paths = suggestImportPaths(currentPath, local[1], files.filter((f) => /\.(?:h|hpp|hh)$/i.test(f.path)), 'js')
  return paths.length ? {
    from: context.pos - local[1].length,
    options: paths.map((path) => ({ label: path, apply: `${path}"`, type: 'text', detail: 'project header', boost: 8 })),
    validFor: /^[\w./-]*$/,
  } : null
}

/**
 * IntelliSense-style completion source. It composes snippets, local and sibling
 * file symbols, language APIs, member suggestions, imports, and C headers.
 * CodeMirror performs fuzzy filtering, so `cnsl` can match `console` like VS Code.
 */
export function getCompletionSourceForLanguage(language: string) {
  const templates = TEMPLATE_COMPLETIONS_BY_LANG[language] || []
  const plainKeywords = keywordsFor(language)
  const memberSet = ['javascript', 'typescript'].includes(language)
    ? JS_OBJECT_MEMBERS
    : language === 'c' || language === 'cpp'
      ? C_MEMBERS
      : []

  return (context: CompletionContext): CompletionResult | null => {
    const header = cHeaderCompletion(context, language)
    if (header) return header

    const line = context.state.doc.lineAt(context.pos)
    const beforeCursor = line.text.slice(0, context.pos - line.from)
    const importHit = matchImportContext(beforeCursor)
    if (importHit) {
      const { currentPath, files } = getProjectIndex()
      const paths = suggestImportPaths(currentPath, importHit.prefix, files, importHit.style)
      if (paths.length) {
        return {
          from: line.from + importHit.from,
          options: paths.map((path) => ({ label: path, type: 'text', boost: 20, detail: 'project file', section: 'Files' })),
          validFor: /^[\w./-]*$/,
        }
      }
    }

    const word = context.matchBefore(/[\w$]*/)
    if (!word) return null
    const charBefore = context.state.sliceDoc(Math.max(0, word.from - 1), word.from)
    const arrow = context.state.sliceDoc(Math.max(0, word.from - 2), word.from) === '->'
    const member = charBefore === '.' || arrow
    if (word.from === word.to && !context.explicit && !member) return null

    const code = context.state.doc.toString()
    const locals = localSymbolsToEntries(extractLocalSymbols(code, language))
    let options: Completion[]

    if (member) {
      options = [
        ...memberSet.map((entry) => completionFromEntry(entry, 'Members', 6)),
        ...locals.filter((entry) => entry.type === 'variable').map((entry) => completionFromEntry(entry, 'Local', 3)),
      ]
    } else {
      const localOptions = locals.map((entry) => completionFromEntry(entry, 'Local', TYPE_BOOST[entry.type] || 8))
      const projectOptions = getProjectSymbols(language)
        .map((entry) => completionFromEntry(entry, 'Workspace', 4))
      const snippetOptions = templates.map((option) => ({ ...option, section: 'Snippets', boost: option.boost ?? 3 }))
      options = [...localOptions, ...projectOptions, ...snippetOptions, ...plainKeywords]
    }

    options = unique(options).slice(0, 400)
    if (!options.length) return null
    return { from: word.from, options, validFor: /^[\w$]*$/ }
  }
}
