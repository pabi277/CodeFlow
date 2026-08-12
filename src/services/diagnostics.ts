// Lightweight project diagnostics — no language server required.
// Finds JSON parse errors, unbalanced brackets (code only), unclosed markdown
// fences, and a few HTML/YAML footguns. Designed to stay cheap on large files.

import type { Diagnostic, DiagnosticSeverity, FileNode } from '../types'
import { detectLanguage } from '../utils/language'

const MAX_FILE_CHARS = 150_000
const MAX_DIAGNOSTICS = 200
const MAX_PER_FILE = 40

interface Draft {
  line: number
  col: number
  severity: DiagnosticSeverity
  message: string
  source: string
}

export function diagnoseFile(node: FileNode): Diagnostic[] {
  if (node.type !== 'file') return []
  const drafts = collectDrafts(node.content, node.path)
  return drafts.slice(0, MAX_PER_FILE).map((d, i) => ({
    id: `${node.id}:${d.source}:${d.line}:${d.col}:${i}`,
    fileId: node.id,
    path: node.path,
    ...d,
  }))
}

export function diagnoseProject(nodeMap: Record<string, FileNode>): Diagnostic[] {
  const files = Object.values(nodeMap).filter((n) => n.type === 'file')
  const out: Diagnostic[] = []
  for (const f of files) {
    if (out.length >= MAX_DIAGNOSTICS) break
    const next = diagnoseFile(f)
    for (const d of next) {
      out.push(d)
      if (out.length >= MAX_DIAGNOSTICS) break
    }
  }
  return out.sort((a, b) => {
    const sev = rank(a.severity) - rank(b.severity)
    if (sev) return sev
    if (a.path !== b.path) return a.path.localeCompare(b.path)
    return a.line - b.line || a.col - b.col
  })
}

function rank(s: DiagnosticSeverity): number {
  return s === 'error' ? 0 : s === 'warning' ? 1 : 2
}

// Bracket matching is only reliable on real programming languages.
// HTML / Markdown / YAML / prose use [], (), and apostrophes in ways
// that look like syntax errors but aren't.
const BRACKET_LANGS = new Set([
  'javascript', 'typescript', 'python', 'c', 'cpp', 'java', 'go', 'rust',
  'php', 'kotlin', 'swift', 'ruby', 'lua', 'css',
])

export function collectDrafts(content: string, path: string): Draft[] {
  if (content.length > MAX_FILE_CHARS) return []
  const lang = detectLanguage(path)
  const drafts: Draft[] = []

  if (lang === 'json') drafts.push(...diagnoseJson(content))
  else if (BRACKET_LANGS.has(lang)) drafts.push(...diagnoseBrackets(content, lang))

  if (lang === 'markdown') drafts.push(...diagnoseMarkdown(content))
  if (lang === 'html' || lang === 'xml') drafts.push(...diagnoseMarkup(content, lang))
  if (lang === 'yaml') drafts.push(...diagnoseYaml(content))

  return drafts
}

function diagnoseJson(src: string): Draft[] {
  const trimmed = src.trim()
  if (!trimmed) return []
  try {
    JSON.parse(src)
    return []
  } catch (err) {
    const msg = (err as Error).message || 'Invalid JSON'
    const loc = jsonErrorLocation(msg, src)
    return [{ line: loc.line, col: loc.col, severity: 'error', message: msg, source: 'json' }]
  }
}

export function jsonErrorLocation(message: string, src: string): { line: number; col: number } {
  const lineCol = message.match(/line\s+(\d+)\s+column\s+(\d+)/i)
  if (lineCol) return { line: Number(lineCol[1]), col: Number(lineCol[2]) }
  const pos = message.match(/position\s+(\d+)/i)
  if (pos) return offsetToLineCol(src, Number(pos[1]))
  return { line: 1, col: 1 }
}

export function offsetToLineCol(src: string, offset: number): { line: number; col: number } {
  const clamped = Math.max(0, Math.min(offset, src.length))
  let line = 1
  let col = 1
  for (let i = 0; i < clamped; i++) {
    if (src[i] === '\n') {
      line++
      col = 1
    } else {
      col++
    }
  }
  return { line, col }
}

const REGEX_PREV = new Set('([{,;:!&|?~^*%=+\n'.split(''))

function diagnoseBrackets(src: string, lang: string): Draft[] {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
  const closing: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  const stack: { ch: string; line: number; col: number }[] = []
  const drafts: Draft[] = []

  const hashComments = lang === 'python' || lang === 'shell' || lang === 'ruby'
  const slashComments = ['javascript', 'typescript', 'java', 'c', 'cpp', 'go', 'rust', 'css', 'php', 'kotlin', 'swift'].includes(lang)
  const jsLike = lang === 'javascript' || lang === 'typescript'
  const pyLike = lang === 'python'

  let i = 0
  let line = 1
  let col = 1
  const len = src.length

  const advance = () => {
    if (src[i] === '\n') {
      line++
      col = 1
    } else {
      col++
    }
    i++
  }

  const skipLineComment = () => {
    while (i < len && src[i] !== '\n') advance()
  }

  const skipBlockComment = () => {
    advance()
    advance()
    while (i < len && !(src[i] === '*' && src[i + 1] === '/')) advance()
    if (i < len) { advance(); advance() }
  }

  const skipQuoted = (quote: string, triple: boolean) => {
    if (triple) { advance(); advance(); advance() }
    else advance()
    while (i < len) {
      if (src[i] === '\\') {
        advance()
        if (i < len) advance()
        continue
      }
      if (triple) {
        if (src[i] === quote && src[i + 1] === quote && src[i + 2] === quote) {
          advance(); advance(); advance()
          return
        }
        advance()
      } else if (src[i] === quote) {
        advance()
        return
      } else {
        advance()
      }
    }
  }

  const skipJsRegex = () => {
    advance()
    let inClass = false
    while (i < len && src[i] !== '\n') {
      const ch = src[i]
      if (ch === '\\') {
        advance()
        if (i < len) advance()
        continue
      }
      if (ch === '[' && !inClass) { inClass = true; advance(); continue }
      if (ch === ']' && inClass) { inClass = false; advance(); continue }
      if (ch === '/' && !inClass) {
        advance()
        while (i < len && /[gimsuy]/.test(src[i])) advance()
        return
      }
      advance()
    }
  }

  const skipTemplate = () => {
    advance()
    while (i < len) {
      if (src[i] === '\\') { advance(); if (i < len) advance(); continue }
      if (src[i] === '`') { advance(); return }
      if (src[i] === '$' && src[i + 1] === '{') {
        advance()
        advance()
        let depth = 1
        while (i < len && depth > 0) {
          if (src[i] === '`') { skipTemplate(); continue }
          if (src[i] === '"' || src[i] === "'") { skipQuoted(src[i], false); continue }
          if (src[i] === '/' && src[i + 1] === '/') { skipLineComment(); continue }
          if (src[i] === '/' && src[i + 1] === '*') { skipBlockComment(); continue }
          if (src[i] === '{') depth++
          else if (src[i] === '}') {
            depth--
            if (depth === 0) { advance(); break }
          }
          advance()
        }
        continue
      }
      advance()
    }
  }

  const isRegexContext = (): boolean => {
    let j = i - 1
    while (j >= 0 && (src[j] === ' ' || src[j] === '\t')) j--
    if (j < 0) return true
    return REGEX_PREV.has(src[j])
  }

  while (i < len) {
    const ch = src[i]
    const next2 = src[i] + (src[i + 1] || '')
    const next3 = next2 + (src[i + 2] || '')

    if (slashComments && next2 === '//') { skipLineComment(); continue }
    if (slashComments && next2 === '/*') { skipBlockComment(); continue }
    if (hashComments && ch === '#') { skipLineComment(); continue }

    if (pyLike && (next3 === '"""' || next3 === "'''")) {
      skipQuoted(next3[0], true)
      continue
    }

    if (jsLike && ch === '`') { skipTemplate(); continue }

    if (jsLike && ch === '/' && src[i + 1] !== '/' && src[i + 1] !== '*' && isRegexContext()) {
      skipJsRegex()
      continue
    }

    if (ch === '"' || ch === "'") {
      skipQuoted(ch, false)
      continue
    }

    if (pairs[ch]) {
      stack.push({ ch, line, col })
    } else if (closing[ch]) {
      const open = closing[ch]
      const top = stack[stack.length - 1]
      if (!top || top.ch !== open) {
        drafts.push({
          line, col, severity: 'error',
          message: `Unmatched '${ch}'`,
          source: 'brackets',
        })
      } else {
        stack.pop()
      }
    }
    advance()
  }

  for (const leftover of stack.slice(0, 12)) {
    drafts.push({
      line: leftover.line,
      col: leftover.col,
      severity: 'error',
      message: `Unclosed '${leftover.ch}'`,
      source: 'brackets',
    })
  }
  return drafts
}

function diagnoseMarkdown(src: string): Draft[] {
  const drafts: Draft[] = []
  const lines = src.split('\n')
  let fence = 0
  let fenceLine = 0
  for (let i = 0; i < lines.length; i++) {
    if (/^```/.test(lines[i])) {
      fence++
      if (fence % 2 === 1) fenceLine = i + 1
    }
    const emptyLink = lines[i].match(/\[([^\]]*)\]\(\s*\)/)
    if (emptyLink) {
      drafts.push({
        line: i + 1,
        col: (emptyLink.index ?? 0) + 1,
        severity: 'warning',
        message: 'Link has an empty destination',
        source: 'markdown',
      })
    }
  }
  if (fence % 2 === 1) {
    drafts.push({
      line: fenceLine || 1,
      col: 1,
      severity: 'error',
      message: 'Unclosed fenced code block',
      source: 'markdown',
    })
  }
  return drafts
}

function diagnoseMarkup(src: string, lang: string): Draft[] {
  const drafts: Draft[] = []
  if (src.includes('<!--') && !src.includes('-->')) {
    const idx = src.indexOf('<!--')
    const loc = offsetToLineCol(src, idx)
    drafts.push({ ...loc, severity: 'error', message: 'Unclosed HTML comment', source: lang })
  }
  const openScript = (src.match(/<script\b/gi) || []).length
  const closeScript = (src.match(/<\/script>/gi) || []).length
  if (openScript > closeScript) {
    drafts.push({ line: 1, col: 1, severity: 'warning', message: 'A <script> tag may be unclosed', source: lang })
  }
  const openStyle = (src.match(/<style\b/gi) || []).length
  const closeStyle = (src.match(/<\/style>/gi) || []).length
  if (openStyle > closeStyle) {
    drafts.push({ line: 1, col: 1, severity: 'warning', message: 'A <style> tag may be unclosed', source: lang })
  }
  return drafts
}

function diagnoseYaml(src: string): Draft[] {
  const drafts: Draft[] = []
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('\t')) {
      drafts.push({
        line: i + 1,
        col: lines[i].indexOf('\t') + 1,
        severity: 'warning',
        message: 'YAML indentation should use spaces, not tabs',
        source: 'yaml',
      })
    }
  }
  return drafts
}
