import type { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { Completion } from '@codemirror/autocomplete'

const COMMENT_NODE = /comment/i
const STRING_NODE = /string|quoted|template/i

/** Syntax-aware guard against noisy suggestions inside comments and literals. */
export function completionSyntaxContext(state: EditorState, pos: number, language = ''): 'code' | 'comment' | 'string' {
  const tree = syntaxTree(state)
  let node = tree.resolveInner(Math.max(0, pos - 1), -1)
  while (node) {
    if (COMMENT_NODE.test(node.name)) return 'comment'
    if (STRING_NODE.test(node.name)) return 'string'
    if (!node.parent) break
    node = node.parent
  }
  if (tree.topNode.firstChild) return 'code'

  // Languages without a Lezer package still get a conservative lexical scan.
  // Scan the whole prefix for normal files so multi-line comments are handled.
  const start = pos < 200_000 ? 0 : state.doc.lineAt(pos).from
  const text = state.sliceDoc(start, pos)
  const hashComment = ['python', 'ruby', 'shell', 'perl', 'r'].includes(language)
  let quote = ''
  let blockComment = false
  let lineComment = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]
    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; i++ }
      continue
    }
    if (quote) {
      if (char === '\\') { i++; continue }
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue }
    if (char === '/' && next === '*') { blockComment = true; i++; continue }
    if (char === '/' && next === '/') { lineComment = true; i++; continue }
    if (hashComment && char === '#') { lineComment = true; continue }
  }
  if (blockComment || lineComment) return 'comment'
  return quote ? 'string' : 'code'
}

/** Words that exist in the current document but weren't recognized as declarations. */
export function documentWordCompletions(state: EditorState, currentWord: string, excluded: Set<string>): Completion[] {
  if (state.doc.length > 600_000) return []
  const text = state.doc.toString()
  const counts = new Map<string, number>()
  for (const match of text.matchAll(/[A-Za-z_$][\w$]{2,}/g)) {
    const word = match[0]
    if (word === currentWord || excluded.has(word)) continue
    counts.set(word, (counts.get(word) || 0) + 1)
    if (counts.size >= 500) break
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 120)
    .map(([label, count]) => ({
      label,
      type: 'text',
      detail: count > 1 ? `${count} references` : 'document word',
      section: 'Document',
      boost: -2,
    }))
}

export function receiverBeforeMember(state: EditorState, memberFrom: number): string {
  const before = state.sliceDoc(Math.max(0, memberFrom - 120), memberFrom)
  return before.match(/([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*(?:\.|->)\s*$/)?.[1] || ''
}
