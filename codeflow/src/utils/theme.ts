import { THEME_PRESETS, type ThemePalette } from '../config/defaults'

export function resolvePalette(preset: string): ThemePalette {
  return THEME_PRESETS[preset] || THEME_PRESETS['default-dark']
}

/**
 * Apply a theme preset's palette as CSS custom properties on <html>.
 * Components consume these via Tailwind theme tokens (--color-*).
 */
export function applyThemePreset(preset: string): ThemePalette {
  const p = resolvePalette(preset)
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
