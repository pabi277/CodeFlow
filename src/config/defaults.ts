import type { AppSettings } from '../types'

// Default settings applied on first launch
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  themePreset: 'default-dark',
  fontSize: 14,
  fontFamily: 'system-monospace',
  tabSize: 4,
  indentWithSpaces: true,
  wordWrap: false,
  autoSave: true,
  autoSaveDelay: 1000,
  showKeyboardToolbar: true,
  keyboardToolbarKeys: {},
  showLineNumbers: true,
  bracketMatching: true,
  showMinimap: false,
  showBreadcrumbs: true,
  showStatusBar: true,
  cursorStyle: 'line',
  smoothCursor: false,
  judge0ApiKey: '',
  judge0BaseUrl: '',
  timeLimit: 5,
  memoryLimit: 128,
  runConfiguration: {},
}

// Language-specific keyboard toolbar layout (default groups)
export const DEFAULT_TOOLBAR_KEYS: Record<string, string[]> = {
  default: ['←', '→', 'Tab', 'Undo', 'Redo', '(', ')', '{', '}', '[', ']', '=', '+', '-', '*', '/', ',', '.', "'", '"', '\\', '_', '<', '>', ';', ':', '?', '!', '&', '|'],
  python: ['←', '→', 'Tab', 'Undo', 'Redo', ':', '#', '_', '.', "f'", "'", '"', '(', ')', '[', ']', '{', '}', '=', '+', '-', '*', '/', '\\', '<', '>', ',', ';'],
  c: ['←', '→', 'Tab', 'Undo', 'Redo', ';', '{', '}', '(', ')', '*', '&', '->', '#', '"', "'", '=', '+', '-', '/', '\\', ',', '_'],
  cpp: ['←', '→', 'Tab', 'Undo', 'Redo', ';', '{', '}', '(', ')', '*', '&', '->', '#', '"', "'", '=', '+', '-', '/', '\\', ',', '_'],
  java: ['←', '→', 'Tab', 'Undo', 'Redo', ';', '{', '}', '(', ')', '@', '"', "'", '.', '=', '+', '-', '*', '/', ',', '_', '<', '>'],
  javascript: ['←', '→', 'Tab', 'Undo', 'Redo', 'Next', ';', '{', '}', '(', ')', '=>', '`', '"', "'", '.', '=', '+', '-', '*', '/', ',', '_'],
  typescript: ['←', '→', 'Tab', 'Undo', 'Redo', 'Next', ';', '{', '}', '(', ')', '=>', '`', '"', "'", '.', '=', '+', '-', '*', '/', ',', '_', '?'],
  go: ['←', '→', 'Tab', 'Undo', 'Redo', ':', '=', ';', '{', '}', '(', ')', '"', '.', '<', '>', '*', '&', '_', ','],
  rust: ['←', '→', 'Tab', 'Undo', 'Redo', ';', '{', '}', '(', ')', '::', '&', '*', '"', "'", '.', ',', '_', '<', '>', '=>'],
  html: ['←', '→', 'Tab', 'Emmet', 'Undo', 'Redo', '<', '>', '/', '"', "'", '=', '&', ';', '(', ')', '{', '}'],
  css: ['←', '→', 'Tab', 'Emmet', 'Undo', 'Redo', '{', '}', ':', ';', '#', '.', ',', '(', ')', '"', "'"],
  shell: ['←', '→', 'Tab', 'Undo', 'Redo', '$', '#', ';', '&', '|', '>', '<', '=', '/', '-', '*', "'", '"', '\\', '~', '!'],
}

export interface ThemePalette {
  name: string
  dark: boolean
  /** app background */
  bg: string
  /** panel / drawer / terminal */
  panel: string
  /** primary text */
  text: string
  /** muted text */
  muted: string
  /** inputs / search bars */
  input: string
  /** interactive accent */
  accent: string
  /** faint borders */
  border: string
  /** editor selection */
  selection: string
  /** active line background */
  activeLine: string
}

export const THEME_PRESETS: Record<string, ThemePalette> = {
  'default-dark': {
    name: 'Default Dark', dark: true,
    bg: '#1e1e2e', panel: '#181825', text: '#cdd6f4', muted: '#a6adc8',
    input: '#2a2b3a', accent: '#89b4fa', border: '#313244', selection: '#45475a80', activeLine: '#31324455',
  },
  dracula: {
    name: 'Dracula', dark: true,
    bg: '#282a36', panel: '#21222c', text: '#f8f8f2', muted: '#b8bcc8',
    input: '#343746', accent: '#bd93f9', border: '#3c3f52', selection: '#44475a80', activeLine: '#44475a66',
  },
  monokai: {
    name: 'Monokai', dark: true,
    bg: '#272822', panel: '#1e1f1c', text: '#f8f8f2', muted: '#cfcfc2',
    input: '#34352e', accent: '#a6e22e', border: '#49483e', selection: '#f9267270', activeLine: '#3e3d32',
  },
  'ayu-mirage': {
    name: 'Ayu Mirage', dark: true,
    bg: '#1f2430', panel: '#171b24', text: '#cbccc6', muted: '#a0a3ad',
    input: '#2a3340', accent: '#ffcc66', border: '#333c4c', selection: '#5ccfe680', activeLine: '#2a334088',
  },
  'tokyo-night': {
    name: 'Tokyo Night', dark: true,
    bg: '#1a1b26', panel: '#16161e', text: '#a9b1d6', muted: '#565f89',
    input: '#24283b', accent: '#7aa2f7', border: '#414868', selection: '#7aa2f750', activeLine: '#292e4290',
  },
  'github-dark': {
    name: 'GitHub Dark', dark: true,
    bg: '#0d1117', panel: '#010409', text: '#e6edf3', muted: '#8b949e',
    input: '#161b22', accent: '#58a6ff', border: '#30363d', selection: '#58a6ff40', activeLine: '#161b22',
  },
  'github-light': {
    name: 'GitHub Light', dark: false,
    bg: '#ffffff', panel: '#f6f8fa', text: '#1f2328', muted: '#57606a',
    input: '#eaeef2', accent: '#0969da', border: '#d0d7de', selection: '#0969da33', activeLine: '#f6f8fa',
  },
}

export const FONT_FAMILIES: Record<string, string> = {
  'system-monospace': "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  'fira-code': "'Fira Code', ui-monospace, monospace",
  'jetbrains-mono': "'JetBrains Mono', ui-monospace, monospace",
  'cascadia-code': "'Cascadia Code', ui-monospace, monospace",
  'source-code-pro': "'Source Code Pro', ui-monospace, monospace",
}
