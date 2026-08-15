import { CompletionContext, type Completion, type CompletionResult } from '@codemirror/autocomplete'
import { KEYWORDS_BY_LANG, JS_OBJECT_MEMBERS, C_MEMBERS } from './keywords'
import { TEMPLATE_COMPLETIONS_BY_LANG, symbolPairCompletion } from './keywordCompletions'
import { extractLocalSymbols, localSymbolsToEntries } from './localSymbols'
import { getProjectIndex } from './projectIndex'
import { matchImportContext, suggestImportPaths } from '../../utils/importPaths'

// Cache plain keyword completions per language
const keywordCache = new Map<string, Completion[]>()
function keywordsFor(lang: string): Completion[] {
  let list = keywordCache.get(lang)
  if (!list) {
    list = (KEYWORDS_BY_LANG[lang] || []).map((e) => ({
      label: e.label,
      type: e.type,
      detail: e.detail,
      boost: TYPE_BOOST[e.type] || 1,
      displayLabel: `${TYPE_GLYPH[e.type] || '·'} ${e.label}`,
    }))
    keywordCache.set(lang, list)
  }
  return list
}

const TYPE_BOOST: Record<string, number> = {
  variable: 1.3, function: 1.15, class: 1.1, keyword: 1.0, member: 0.9, type: 1.0,
}
const TYPE_GLYPH: Record<string, string> = {
  function: 'ƒ', class: 'C', type: 'T', keyword: 'k', variable: '·', member: '·',
}

/**
 * Build a CodeMirror completion source for a given logical language key.
 * Combines: rich template snippets, plain keywords, locally-defined symbols,
 * member completions after ".", and symbol-pair suggestions.
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
    // Symbol pair suggestions (type "(" → suggest "()")
    const pairOptions = symbolPairCompletion(context)
    if (pairOptions && pairOptions.length) {
      const before = context.matchBefore(/[({["'`]/)!
      return { from: before.from, options: pairOptions, validFor: /^$/ }
    }

    const line = context.state.doc.lineAt(context.pos)
    const importHit = matchImportContext(line.text.slice(0, context.pos - line.from))
    if (importHit) {
      const { currentPath, files } = getProjectIndex()
      const paths = suggestImportPaths(currentPath, importHit.prefix, files, importHit.style)
      if (paths.length) {
        return {
          from: line.from + importHit.from,
          options: paths.map((p) => ({ label: p, type: 'text', boost: 2, detail: 'file' })),
          validFor: /^[\w./-]*$/,
        }
      }
    }

    const word = context.matchBefore(/\w+/)
    if (!word) return null
    if (word.from === word.to && !context.explicit) return null

    const before = context.state.sliceDoc(Math.max(0, word.from - 1), word.from)
    const arrow = context.state.sliceDoc(Math.max(0, word.from - 2), word.from) === '->'

    let options: Completion[]
    if (before === '.' || arrow) {
      const locals = language === 'c'
        ? localSymbolsToEntries(extractLocalSymbols(context.state.doc.toString(), language))
          .filter((e) => e.type === 'variable' || e.type === 'type')
        : []
      options = [
        ...locals.map((e) => ({ label: e.label, type: e.type, boost: 1.2 })),
        ...memberSet.map((e) => ({ label: e.label, type: e.type, detail: e.detail, boost: 1.1 })),
      ]
    } else {
      const code = context.state.doc.toString()
      const locals = localSymbolsToEntries(extractLocalSymbols(code, language))
        .map((e) => ({ label: e.label, type: e.type, boost: TYPE_BOOST[e.type] || 1 }))
      options = [...locals, ...templates, ...plainKeywords]
    }

    const prefix = word.text.toLowerCase()
    const scored = options
      .filter((o) => o.label.toLowerCase().startsWith(prefix))
      .map((o) => ({ o, s: (o.label.startsWith(word.text) ? 10 : 5) + (o.boost || 1) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.o)
      .slice(0, 50)

    if (!scored.length) return null
    return { from: word.from, options: scored, validFor: /^\w*$/ }
  }
}
