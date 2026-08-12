// Lightweight project diagnostics — no language server required.
// Finds JSON parse errors, unbalanced brackets, unclosed markdown fences,
// and a few HTML/YAML footguns. Designed to stay cheap on large files.

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

export function collectDrafts(content: string, path: string): Draft[] {
  if (content.length > MAX_FILE_CHARS) return []
  const lang = detectLanguage(path)
  const drafts: Draft[] = []

  if (lang === 'json') {
    drafts.push(...diagnoseJson(content))
  } else {
    drafts.push(...diagnoseBrackets(content, lang))
  }

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

function diagnoseBrackets(src: string, lang: string): Draft[] {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
  const closing: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  const stack: { ch: string; line: number; col: number }[] = []
  const drafts: Draft[] = []

  const hashComments = lang === 'python' || lang === 'shell' || lang === 'yaml' || lang === 'ruby'
  const jsComments = ['javascript', 'typescript', 'java', 'c', 'cpp', 'go', 'rust', 'css', 'php', 'kotlin', 'swift'].includes(lang)
  const pyStrings = lang === 'python'

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

  while (i < len) {
    const ch = src[i]
    const next2 = src.slice(i, i + 2)
    const next3 = src.slice(i, i + 3)

    if (jsComments && next2 === '//') {
      while (i < len && src[i] !== '\n') advance()
      continue
    }
    if ((jsComments || lang === 'html' || lang === 'xml') && next2 === '/*') {
      advance(); advance()
      while (i < len && src.slice(i, i + 2) !== '*/') advance()
      if (i < len) { advance(); advance() }
      continue
    }
    if (hashComments && ch === '#') {
      while (i < len && src[i] !== '\n') advance()
      continue
    }
    if (pyStrings && (next3 === '"""' || next3 === "'''")) {
      const q = next3
      advance(); advance(); advance()
      while (i < len && src.slice(i, i + 3) !== q) advance()
      if (i < len) { advance(); advance(); advance() }
      continue
    }
    if (ch === '"' || ch === "'" || (ch === '`' && (lang === 'javascript' || lang === 'typescript'))) {
      const q = ch
      advance()
      while (i < len && src[i] !== q) {
        if (src[i] === '\\') advance()
        if (i < len) advance()
      }
      if (i < len) advance()
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
