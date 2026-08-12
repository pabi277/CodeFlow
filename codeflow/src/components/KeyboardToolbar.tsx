import { useStore } from '../store/useStore'
import { detectLanguage } from '../utils/language'
import { DEFAULT_TOOLBAR_KEYS } from '../config/defaults'
import { insertText, moveCursorLeft, moveCursorRight, undoAction, redoAction, indentAtCursor, triggerCompletion } from '../utils/editorApi'
import { useKeyboardHeight } from '../hooks/useKeyboardHeight'
import { VscSymbolMethod } from 'react-icons/vsc'

export function KeyboardToolbar() {
  const show = useStore((s) => s.settings.showKeyboardToolbar)
  const customKeys = useStore((s) => s.settings.keyboardToolbarKeys)
  const activeTabId = useStore((s) => s.activeTabId)
  const nodeMap = useStore((s) => s.nodeMap)

  const kbHeight = useKeyboardHeight()
  const node = activeTabId ? nodeMap[activeTabId] : undefined
  if (!show) return null
  const lang = node ? detectLanguage(node.path) : 'default'
  const keys = customKeys[lang] || DEFAULT_TOOLBAR_KEYS[lang] || DEFAULT_TOOLBAR_KEYS.default

  const press = (key: string) => {
    switch (key) {
      case '←': return moveCursorLeft()
      case '→': return moveCursorRight()
      case 'Tab': return indentAtCursor()
      case 'Undo': return undoAction()
      case 'Redo': return redoAction()
      case '->': return insertText('->')
      case '=>': return insertText('=>')
      case '::': return insertText('::')
      default: return insertText(key)
    }
  }

  return (
    <>
      {/* in-flow spacer reserves the toolbar's height so the terminal/editor
          above don't hide behind the fixed toolbar */}
      <div aria-hidden className="shrink-0" style={{ height: 60 + kbHeight }} />
      <div
        className="fixed inset-x-0 z-40 flex items-center gap-1 overflow-x-auto border-t border-border/60 bg-surface px-2 py-1.5 shadow-[0_-2px_8px_rgba(0,0,0,0.1)] transition-[bottom] duration-150 dark:bg-panel [scrollbar-width:none]"
        style={{ bottom: kbHeight, scrollbarWidth: 'none', paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
      >
      <button
        onPointerDown={(e) => { e.preventDefault(); triggerCompletion() }}
        className="mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent transition-transform duration-100 active:scale-95"
        style={{ touchAction: 'manipulation' }}
        aria-label="Show suggestions"
      >
        <VscSymbolMethod size={18} />
      </button>
      {keys.map((k, i) => {
        const special = ['←', '→', 'Tab', 'Undo', 'Redo'].includes(k)
        return (
          <button
            key={`${k}-${i}`}
            onPointerDown={(e) => { e.preventDefault(); press(k) }}
            className={`flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-[15px] transition-transform duration-100 active:scale-95 active:bg-white/10 ${
              special ? 'font-semibold text-accent' : 'text-ink'
            }`}
            style={{ touchAction: 'manipulation' }}
            aria-label={`Insert ${k}`}
          >
            {k}
          </button>
        )
      })}
      </div>
    </>
  )
}
