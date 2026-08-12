import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import type { ThemePalette } from '../config/defaults'

// CodeMirror theme + syntax highlight, generated from a ThemePalette so theme
// presets affect the editor surface and token colors.
export function editorTheme(p: ThemePalette): ReturnType<typeof EditorView.theme> {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: 'transparent',
        color: p.text,
        fontSize: '14px',
        height: '100%',
        caretColor: p.accent,
      },
      '.cm-scroller': { fontFamily: 'var(--font-mono, ui-monospace, monospace)', lineHeight: '1.55' },
      '.cm-content': { caretColor: p.accent, padding: '6px 0' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: p.accent },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: p.selection,
      },
      '.cm-activeLine': { backgroundColor: p.activeLine },
      '.cm-gutters': { backgroundColor: 'transparent', color: p.muted, border: 'none', borderRight: `1px solid ${p.border}66` },
      '.cm-activeLineGutter': { backgroundColor: 'transparent', color: p.text },
      '.cm-matchingBracket': { backgroundColor: `${p.accent}33`, outline: `1px solid ${p.accent}88` },
      '.cm-foldPlaceholder': { backgroundColor: p.input, border: 'none', color: p.text },
      '.cm-tooltip': { backgroundColor: p.panel, color: p.text, border: `1px solid ${p.border}` },
      // mobile-friendly completion dropdown
      '.cm-tooltip.cm-tooltip-autocomplete > ul': { maxHeight: '40vh', overflowY: 'auto', fontFamily: 'ui-monospace, monospace' },
      '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: `${p.accent}22` },
      '.cm-tooltip-autocomplete ul li': { padding: '9px 12px', minHeight: '38px', display: 'flex', alignItems: 'center' },
      '.cm-completionIcon': { opacity: 0.7 },
      '.cm-panels': { backgroundColor: p.panel, color: p.text },
      '.cm-panels.cm-panels-bottom': { borderTop: `1px solid ${p.border}` },
      '.cm-panels input': { color: p.text, backgroundColor: p.input },
      '.cm-button': { color: p.text, backgroundColor: p.input, backgroundImage: 'none', borderRadius: '6px', border: 'none', padding: '2px 8px' },
      '.cm-textfield': { color: p.text, backgroundColor: p.input, border: `1px solid ${p.border}`, borderRadius: '6px' },
      '.cm-searchMatch': { backgroundColor: `${p.accent}55`, outline: 'none' },
      '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: `${p.accent}99` },
    },
    { dark: p.dark },
  )
}

// Per-theme token highlight styles (dark & light tuned sets)
function highlightFor(p: ThemePalette): HighlightStyle {
  const accent = p.accent
  if (p.dark) {
    return HighlightStyle.define([
      { tag: t.keyword, color: '#cba6f7' },
      { tag: t.comment, color: p.muted, fontStyle: 'italic' },
      { tag: t.string, color: '#a6e3a1' },
      { tag: t.number, color: '#fab387' },
      { tag: t.function(t.variableName), color: accent },
      { tag: t.typeName, color: '#f9e2af' },
      { tag: t.className, color: '#f9e2af' },
      { tag: t.propertyName, color: '#94e2d5' },
      { tag: t.operator, color: accent },
      { tag: t.bool, color: '#fab387' },
      { tag: t.tagName, color: '#f38ba8' },
      { tag: t.attributeName, color: '#a6e3a1' },
      { tag: t.variableName, color: p.text },
      { tag: t.null, color: '#fab387' },
      { tag: t.regexp, color: '#a6e3a1' },
      { tag: t.punctuation, color: p.muted },
    ])
  }
  return HighlightStyle.define([
    { tag: t.keyword, color: '#cf222e' },
    { tag: t.comment, color: p.muted, fontStyle: 'italic' },
    { tag: t.string, color: '#0a3069' },
    { tag: t.number, color: '#0550ae' },
    { tag: t.function(t.variableName), color: '#8250df' },
    { tag: t.typeName, color: '#953800' },
    { tag: t.className, color: '#953800' },
    { tag: t.propertyName, color: '#116329' },
    { tag: t.operator, color: '#0550ae' },
    { tag: t.bool, color: '#0550ae' },
    { tag: t.tagName, color: '#116329' },
    { tag: t.attributeName, color: '#0550ae' },
    { tag: t.variableName, color: p.text },
    { tag: t.null, color: '#0550ae' },
    { tag: t.regexp, color: '#0a3069' },
    { tag: t.punctuation, color: p.muted },
  ])
}

export function editorExtensionsForPalette(p: ThemePalette) {
  return [editorTheme(p), syntaxHighlighting(highlightFor(p))]
}
