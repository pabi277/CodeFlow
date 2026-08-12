export const SITE = {
  name: 'CodeFlow',
  tagline: 'A mobile-first code editor in your pocket',
  description:
    'CodeFlow is a free, open-source, mobile-first code editor PWA. Edit Python, JavaScript, HTML and more on your phone — with GitHub, Termux, live preview, and offline support.',
  url: 'https://github.com/pabi277/CodeFlow',
  repo: 'https://github.com/pabi277/CodeFlow',
  issues: 'https://github.com/pabi277/CodeFlow/issues',
  license: 'MIT',
  version: '0.6.0',
} as const

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl/Cmd+P', action: 'Command palette' },
  { keys: 'Ctrl/Cmd+T', action: 'Go to symbol in workspace' },
  { keys: 'Ctrl/Cmd+G', action: 'Go to line' },
  { keys: 'Ctrl/Cmd+F', action: 'Find in file' },
  { keys: 'Ctrl/Cmd+Shift+F', action: 'Find in project' },
  { keys: 'Ctrl/Cmd+B', action: 'Toggle file explorer' },
  { keys: 'Ctrl/Cmd+J', action: 'Toggle terminal' },
  { keys: 'Ctrl/Cmd+K Z', action: 'Toggle zen mode' },
  { keys: 'Ctrl/Cmd+Tab', action: 'Cycle editor tabs' },
  { keys: 'F12 / Ctrl+Click', action: 'Go to definition' },
  { keys: 'Shift+F12', action: 'Find all references' },
  { keys: 'F2', action: 'Rename symbol' },
  { keys: 'Ctrl/Cmd+I', action: 'Expand selection (smart)' },
  { keys: 'Ctrl/Cmd+D', action: 'Add next occurrence (multi-cursor)' },
  { keys: 'Shift+Alt+Drag', action: 'Column / box selection' },
  { keys: 'Alt+Click', action: 'Add another cursor' },
  { keys: 'Tab', action: 'Expand Emmet (HTML/CSS)' },
  { keys: 'Shift+Alt+F', action: 'Format document (Prettier)' },
  { keys: '?', action: 'Keyboard shortcuts' },
  { keys: 'Esc', action: 'Close dialogs / exit zen' },
]
