import { useEffect, useState } from 'react'
import { getEditor } from '../../utils/editorApi'
import { extractLocalSymbols, type LocalSymbol } from '../../editor/completions/localSymbols'
import { detectLanguage } from '../../utils/language'
import { useStore } from '../../store/useStore'

export function StickyScroll() {
  const enabled = useStore((s) => s.settings.stickyScroll)
  const activeTabId = useStore((s) => s.activeTabId)
  const nodeMap = useStore((s) => s.nodeMap)
  const goToLocation = useStore((s) => s.goToLocation)
  const file = activeTabId ? nodeMap[activeTabId] : undefined
  const [headers, setHeaders] = useState<LocalSymbol[]>([])

  useEffect(() => {
    if (!enabled || !file) {
      setHeaders([])
      return
    }
    const lang = detectLanguage(file.path)
    const symbols = extractLocalSymbols(file.content, lang).filter((s) => s.type === 'function' || s.type === 'class')

    const update = () => {
      const view = getEditor()
      if (!view) return
      const topLine = view.state.doc.lineAt(view.lineBlockAtHeight(view.scrollDOM.scrollTop + 4).from).number
      const active = symbols.filter((s) => s.line < topLine).slice(-3)
      setHeaders(active)
    }

    const view = getEditor()
    view?.scrollDOM.addEventListener('scroll', update, { passive: true })
    update()
    return () => view?.scrollDOM.removeEventListener('scroll', update)
  }, [enabled, file, activeTabId])

  if (!enabled || !file || !headers.length) return null

  return (
    <div className="pointer-events-auto absolute inset-x-0 top-0 z-10 border-b border-border/50 bg-surface/95 text-[12px] shadow-sm backdrop-blur dark:bg-panel/95">
      {headers.map((h) => (
        <button
          key={`${h.type}:${h.name}:${h.line}`}
          onClick={() => goToLocation(file.id, h.line, 1)}
          className="flex w-full items-center gap-2 truncate px-3 py-1 text-left text-ink hover:bg-white/5"
        >
          <span className="text-ink-muted">{h.type === 'class' ? 'C' : 'ƒ'}</span>
          <span className="truncate font-medium">{h.name}</span>
          <span className="ml-auto text-[10px] text-ink-muted">L{h.line}</span>
        </button>
      ))}
    </div>
  )
}
