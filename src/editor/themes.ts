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
      '.cm-content': { caretColor: p.accent, padding: '8px 0 40px' },
      '.cm-line': { padding: '0 8px' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: p.accent, borderLeftWidth: '2px' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: p.selection,
      },
      '.cm-activeLine': { backgroundColor: p.activeLine, boxShadow: `inset 2px 0 0 ${p.accent}55` },
      '.cm-gutters': { backgroundColor: `${p.panel}cc`, color: p.muted, border: 'none', borderRight: `1px solid ${p.border}88` },
      '.cm-lineNumbers .cm-gutterElement': { minWidth: '42px', padding: '0 10px 0 6px' },
      '.cm-foldGutter .cm-gutterElement': { padding: '0 5px', color: p.muted },
      '.cm-activeLineGutter': { backgroundColor: p.activeLine, color: p.accent, fontWeight: '600' },
      '.cm-matchingBracket': { backgroundColor: `${p.accent}33`, outline: `1px solid ${p.accent}99`, borderRadius: '2px' },
      '.cm-foldPlaceholder': { backgroundColor: p.input, border: `1px solid ${p.border}`, color: p.text, borderRadius: '3px' },
      '.cm-tooltip': { backgroundColor: p.panel, color: p.text, border: `1px solid ${p.border}`, zIndex: '30' },
      // IntelliSense popup: compact desktop density with touch-friendly rows.
      '.cm-tooltip.cm-tooltip-autocomplete.codeflow-intellisense': {
        width: 'min(92vw, 430px)',
        maxWidth: 'min(92vw, 430px)',
        overflow: 'hidden',
        borderRadius: '6px',
        border: `1px solid ${p.border}`,
        boxShadow: p.dark ? '0 12px 34px rgba(0,0,0,.62), 0 2px 8px rgba(0,0,0,.38)' : '0 12px 32px rgba(31,35,40,.22), 0 2px 6px rgba(31,35,40,.12)',
      },
      '.codeflow-intellisense > ul': {
        maxHeight: 'min(40vh, 340px)', overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y',
        WebkitOverflowScrolling: 'touch', fontFamily: 'var(--font-mono, ui-monospace, monospace)', padding: '3px 0',
      },
      '.codeflow-intellisense ul li': {
        padding: '5px 8px', minHeight: '30px', display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '2px solid transparent',
      },
      '.codeflow-intellisense ul li[aria-selected]': {
        backgroundColor: `${p.accent}24`, borderLeftColor: p.accent, color: p.text,
      },
      '.codeflow-intellisense .cm-completionLabel': { fontSize: '12.5px', fontWeight: '500', minWidth: '0' },
      '.codeflow-intellisense .cm-completionDetail': { marginLeft: 'auto', color: p.muted, fontSize: '10.5px', fontStyle: 'normal', opacity: '0.85' },
      '.codeflow-intellisense .cm-completionMatchedText': { color: p.accent, textDecoration: 'none', fontWeight: '750' },
      '.codeflow-intellisense .cm-completionIcon': { opacity: '1', width: '17px', height: '17px', flex: '0 0 17px' },
      '.codeflow-intellisense .cm-completionIcon-function, .codeflow-intellisense .cm-completionIcon-method': { color: '#c586c0' },
      '.codeflow-intellisense .cm-completionIcon-variable, .codeflow-intellisense .cm-completionIcon-property': { color: '#9cdcfe' },
      '.codeflow-intellisense .cm-completionIcon-class, .codeflow-intellisense .cm-completionIcon-type, .codeflow-intellisense .cm-completionIcon-interface': { color: '#4ec9b0' },
      '.codeflow-intellisense .cm-completionIcon-keyword': { color: '#569cd6' },
      '.codeflow-intellisense .cm-completionIcon-snippet': { color: '#dcdcaa' },
      '.codeflow-intellisense .cm-completionSource': {
        marginLeft: '6px', padding: '1px 4px', borderRadius: '3px', color: p.muted, backgroundColor: p.input, fontSize: '8.5px', letterSpacing: '.02em', textTransform: 'uppercase',
      },
      '.codeflow-intellisense .cm-completionSection': {
        padding: '4px 8px 2px', color: p.muted, backgroundColor: `${p.input}aa`, fontSize: '9px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase',
      },
      '.cm-tooltip.cm-completionInfo.codeflow-intellisense-info': {
        maxWidth: 'min(88vw, 360px)', padding: '9px 11px', borderRadius: '6px', color: p.text, backgroundColor: p.panel,
        border: `1px solid ${p.border}`, boxShadow: '0 10px 26px rgba(0,0,0,.35)', fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: '11px', lineHeight: '1.5',
      },
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
