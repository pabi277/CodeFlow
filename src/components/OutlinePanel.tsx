import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { detectLanguage } from '../utils/language'
import { extractLocalSymbols } from '../editor/completions/localSymbols'
import { VscSymbolClass, VscSymbolMethod, VscSymbolVariable } from 'react-icons/vsc'

export function OutlinePanel() {
  const activeTabId = useStore((s) => s.activeTabId)
  const nodeMap = useStore((s) => s.nodeMap)
  const goToLocation = useStore((s) => s.goToLocation)
  const file = activeTabId ? nodeMap[activeTabId] : undefined
  const [query, setQuery] = useState('')

  const symbols = useMemo(() => {
    if (!file) return []
    const lang = detectLanguage(file.path)
    const all = extractLocalSymbols(file.content, lang)
    const important = all.filter((s) => s.type === 'function' || s.type === 'class')
    const vars = all.filter((s) => s.type === 'variable')
    return [...important, ...(important.length < 8 ? vars : [])].slice(0, 200)
  }, [file])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return symbols
    return symbols.filter((s) => s.name.toLowerCase().includes(q))
  }, [symbols, query])

  if (!file) {
    return <p className="px-3 py-6 text-center text-[12px] text-ink-muted">Open a file to see its outline.</p>
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/40 px-2 py-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter symbols…"
          className="h-8 w-full rounded-md border border-border/60 bg-input px-2 text-[12px] text-ink outline-none focus:border-accent"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {filtered.length ? (
          filtered.map((s) => (
            <button
              key={`${s.type}:${s.name}:${s.line}`}
              onClick={() => goToLocation(file.id, s.line, 1)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left active:bg-white/5"
            >
              <span className="shrink-0 text-ink-muted">
                {s.type === 'class' ? <VscSymbolClass /> : s.type === 'function' ? <VscSymbolMethod /> : <VscSymbolVariable />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{s.name}</span>
              <span className="shrink-0 text-[11px] text-ink-muted">{s.line}</span>
            </button>
          ))
        ) : (
          <p className="px-3 py-6 text-center text-[12px] text-ink-muted">No symbols found in this file.</p>
        )}
      </div>
    </div>
  )
}
