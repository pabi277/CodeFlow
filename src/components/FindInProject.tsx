import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { FiSearch, FiFile, FiX } from 'react-icons/fi'

export function FindInProject() {
  const open = useStore((s) => s.findInProjectOpen)
  const setOpen = useStore((s) => s.setFindInProject)
  const nodeMap = useStore((s) => s.nodeMap)
  const openFile = useStore((s) => s.openFile)
  const [query, setQuery] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = matchCase ? query : query.toLowerCase()
    const out: { id: string; path: string; lineNo: number; line: string }[] = []
    for (const n of Object.values(nodeMap)) {
      if (n.type !== 'file') continue
      const lines = n.content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const hay = matchCase ? line : line.toLowerCase()
        if (hay.includes(q)) {
          out.push({ id: n.id, path: n.path, lineNo: i + 1, line: line.trim() })
        }
      }
    }
    return out.slice(0, 200)
  }, [query, matchCase, nodeMap])

  if (!open) return null

  const go = (id: string) => {
    openFile(id)
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-surface animate-drawer-in dark:bg-panel" role="dialog" aria-label="Find in project">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-input px-3 py-2">
          <FiSearch className="text-ink-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all files…"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-muted/60"
          />
        </div>
        <button
          onClick={() => setMatchCase((v) => !v)}
          className={`rounded-lg px-2.5 py-2 text-[11px] font-semibold ${matchCase ? 'bg-accent text-white' : 'bg-input text-ink-muted'}`}
        >
          Aa
        </button>
        <button onClick={() => setOpen(false)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted active:bg-white/10">
          <FiX />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-6">
        {query.trim() ? (
          results.length ? (
            results.map((r, i) => (
              <button
                key={`${r.id}-${i}`}
                onClick={() => go(r.id)}
                className="mb-1 flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left active:bg-white/5"
              >
                <span className="mt-0.5 text-ink-muted"><FiFile /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="truncate font-medium text-ink">{r.path}</span>
                    <span className="shrink-0 text-ink-muted">:{r.lineNo}</span>
                  </div>
                  <div className="truncate font-mono text-[12px] text-ink-muted">{r.line}</div>
                </div>
              </button>
            ))
          ) : (
            <p className="py-8 text-center text-[13px] text-ink-muted">No matches for "{query}"</p>
          )
        ) : (
          <p className="py-8 text-center text-[13px] text-ink-muted">Type to search across all files in the project</p>
        )}
      </div>
    </div>
  )
}
