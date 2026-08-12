import { THEME_PRESETS } from '../config/defaults'
import type { ThemePalette } from '../types'

export function resolvePalette(preset: string, custom: Record<string, ThemePalette> = {}): ThemePalette {
  return custom[preset] || THEME_PRESETS[preset] || THEME_PRESETS['default-dark']
}

/**
 * Apply a theme preset's palette as CSS custom properties on <html>.
 * Components consume these via Tailwind theme tokens (--color-*).
 */
export function applyThemePreset(preset: string, custom: Record<string, ThemePalette> = {}): ThemePalette {
  const p = resolvePalette(preset, custom)
  const root = document.documentElement
  const vars: Record<string, string> = {
    '--surface': p.bg,
    '--panel': p.panel,
    '--ink': p.text,
    '--ink-muted': p.muted,
    '--accent': p.accent,
    '--input': p.input,
    '--border': p.border,
    '--selection': p.selection,
    '--active-line': p.activeLine,
  }
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  root.classList.toggle('dark', p.dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', p.bg)
  return p
}
