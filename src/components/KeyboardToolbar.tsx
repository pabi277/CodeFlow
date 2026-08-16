import { useStore } from '../store/useStore'
import { detectLanguage } from '../utils/language'
import { DEFAULT_TOOLBAR_KEYS } from '../config/defaults'
import { insertText, moveCursorLeft, moveCursorRight, undoAction, redoAction, indentAtCursor, triggerCompletion, selectNextMatch, expandEmmet } from '../utils/editorApi'
import { useKeyboardHeight } from '../hooks/useKeyboardHeight'
import { VscSymbolMethod } from 'react-icons/vsc'
import { useHorizontalScrollClickGuard } from '../hooks/useHorizontalScrollClickGuard'

export function KeyboardToolbar() {
  const show = useStore((s) => s.settings.showKeyboardToolbar)
  const customKeys = useStore((s) => s.settings.keyboardToolbarKeys)
  const activeTabId = useStore((s) => s.activeTabId)
  const nodeMap = useStore((s) => s.nodeMap)

  const kbHeight = useKeyboardHeight()
  const scrollGuard = useHorizontalScrollClickGuard(8)
  const node = activeTabId ? nodeMap[activeTabId] : undefined
  if (!show) return null
  // On phones the toolbar sits on the home-gesture strip. Only show it while
  // the soft keyboard is open so a swipe-home cannot tap Undo/Redo.
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  if (coarse && kbHeight < 48) {
    return <div aria-hidden className="shrink-0" style={{ height: 0 }} />
  }
  const lang = node ? detectLanguage(node.path) : 'default'
  const keys = customKeys[lang] || DEFAULT_TOOLBAR_KEYS[lang] || DEFAULT_TOOLBAR_KEYS.default

  const press = (key: string) => {
    switch (key) {
      case '←': return moveCursorLeft()
      case '→': return moveCursorRight()
      case 'Tab': return indentAtCursor()
      case 'Emmet': return expandEmmet(lang)
      case 'Next': return selectNextMatch()
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
        {...scrollGuard}
        className="bar-glass fixed inset-x-0 z-40 flex items-center gap-1 overflow-x-auto border-t border-border/50 px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.18)] transition-[bottom] duration-150 [scrollbar-width:none]"
        style={{ bottom: kbHeight, scrollbarWidth: 'none', paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))', touchAction: 'pan-x' }}
      >
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => triggerCompletion()}
        className="icon-tile mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white transition-transform duration-100 active:scale-95"
        style={{ touchAction: 'pan-x' }}
        aria-label="Show suggestions"
      >
        <VscSymbolMethod size={18} />
      </button>
      {keys.map((k, i) => {
        const special = ['←', '→', 'Tab', 'Undo', 'Redo', 'Emmet', 'Next'].includes(k)
        return (
          <button
            key={`${k}-${i}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => press(k)}
            className={`kbd-key flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-[15px] ${
              special ? 'font-semibold text-accent' : 'text-ink'
            }`}
            style={{ touchAction: 'pan-x' }}
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
