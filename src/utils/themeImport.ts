// Import a VS Code-style color-theme JSON into a CodeFlow palette.

import type { ThemePalette } from '../types'

export interface ImportedTheme {
  key: string
  palette: ThemePalette
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'custom'
}

function pick(colors: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = colors[k]
    if (typeof v === 'string' && /^#([0-9a-f]{3,8})$/i.test(v.trim())) return v.trim()
  }
  return undefined
}

export function parseVsCodeTheme(raw: unknown): ImportedTheme {
  if (!raw || typeof raw !== 'object') throw new Error('Theme JSON must be an object')
  const obj = raw as { name?: string; type?: string; colors?: Record<string, string> }
  const colors = obj.colors && typeof obj.colors === 'object' ? obj.colors : {}
  const name = (obj.name || 'Custom theme').toString().slice(0, 48)
  const dark = obj.type !== 'light'
  const palette: ThemePalette = {
    name,
    dark,
    bg: pick(colors, 'editor.background', 'background') || (dark ? '#1e1e2e' : '#ffffff'),
    panel: pick(colors, 'sideBar.background', 'activityBar.background') || (dark ? '#181825' : '#f6f8fa'),
    text: pick(colors, 'editor.foreground', 'foreground') || (dark ? '#cdd6f4' : '#1f2328'),
    muted: pick(colors, 'descriptionForeground', 'sideBar.foreground') || (dark ? '#a6adc8' : '#57606a'),
    input: pick(colors, 'input.background', 'dropdown.background') || (dark ? '#2a2b3a' : '#eaeef2'),
    accent: pick(colors, 'focusBorder', 'button.background', 'tab.activeBorder') || (dark ? '#89b4fa' : '#0969da'),
    border: pick(colors, 'panel.border', 'sideBar.border', 'editorGroup.border') || (dark ? '#313244' : '#d0d7de'),
    selection: pick(colors, 'editor.selectionBackground') || (dark ? '#45475a80' : '#0969da33'),
    activeLine: pick(colors, 'editor.lineHighlightBackground') || (dark ? '#31324455' : '#f6f8fa'),
  }
  return { key: `custom-${slug(name)}`, palette }
}

export function parseThemeText(text: string): ImportedTheme {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not valid JSON')
  }
  return parseVsCodeTheme(parsed)
}
