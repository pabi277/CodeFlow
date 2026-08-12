export const SITE = {
  name: 'CodeFlow',
  tagline: 'A mobile-first code editor in your pocket',
  description:
    'CodeFlow is a free, open-source, mobile-first code editor PWA. Edit Python, JavaScript, HTML and more on your phone — with GitHub, Termux, live preview, and offline support.',
  url: 'https://github.com/pabi277/CodeFlow',
  repo: 'https://github.com/pabi277/CodeFlow',
  issues: 'https://github.com/pabi277/CodeFlow/issues',
  license: 'MIT',
  version: '0.5.0',
} as const

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl/Cmd+P', action: 'Command palette' },
  { keys: 'Ctrl/Cmd+G', action: 'Go to line' },
  { keys: 'Ctrl/Cmd+F', action: 'Find in file' },
  { keys: 'Ctrl/Cmd+Shift+F', action: 'Find in project' },
  { keys: 'Ctrl/Cmd+B', action: 'Toggle file explorer' },
  { keys: 'Ctrl/Cmd+J', action: 'Toggle terminal' },
  { keys: 'Ctrl/Cmd+D', action: 'Add next occurrence (multi-cursor)' },
  { keys: 'Alt+Click', action: 'Add another cursor' },
  { keys: 'Tab', action: 'Expand Emmet (HTML/CSS)' },
  { keys: 'Shift+Alt+F', action: 'Format document (Prettier)' },
  { keys: '?', action: 'Keyboard shortcuts' },
  { keys: 'Esc', action: 'Close dialogs' },
]
