import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { collectWorkspaceSymbols, filterSymbols } from '../utils/symbolNav'
import { getWordAtCursor } from '../utils/editorApi'
import { VscSymbolClass, VscSymbolMethod, VscSymbolVariable, VscClose } from 'react-icons/vsc'

export function SymbolSearch() {
  const open = useStore((s) => s.symbolSearchOpen)
  const setOpen = useStore((s) => s.setSymbolSearchOpen)
  const nodeMap = useStore((s) => s.nodeMap)
  const goToLocation = useStore((s) => s.goToLocation)
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  const symbols = useMemo(() => {
    const files = Object.values(nodeMap).filter((n) => n.type === 'file').map((n) => ({ id: n.id, path: n.path, content: n.content }))
    return collectWorkspaceSymbols(files)
  }, [nodeMap, open])

  const results = useMemo(() => filterSymbols(symbols, query), [symbols, query])

  useEffect(() => { setSel(0) }, [query])

  if (!open) return null

  const run = (i: number) => {
    const hit = results[i]
    if (!hit) return
    void goToLocation(hit.fileId, hit.line, hit.col)
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[56] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Go to symbol">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" onClick={() => setOpen(false)} />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border/60 bg-surface shadow-modal animate-palette-in dark:bg-panel">
        <div className="flex h-14 items-center gap-2 border-b border-border/60 px-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((i) => Math.min(results.length - 1, i + 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((i) => Math.max(0, i - 1)) }
              else if (e.key === 'Enter') { e.preventDefault(); run(sel) }
              else if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="Go to symbol in workspace…"
            className="flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-muted/60"
          />
          <button onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted">
            <VscClose />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1">
          {results.length ? results.map((s, i) => (
            <button
              key={`${s.fileId}:${s.name}:${s.line}`}
              onClick={() => run(i)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left ${i === sel ? 'bg-accent/15' : 'active:bg-white/5'}`}
            >
              <span className="text-ink-muted">
                {s.type === 'class' ? <VscSymbolClass /> : s.type === 'function' ? <VscSymbolMethod /> : <VscSymbolVariable />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{s.name}</span>
              <span className="shrink-0 truncate text-[11px] text-ink-muted">{s.path}:{s.line}</span>
            </button>
          )) : (
            <p className="py-8 text-center text-[13px] text-ink-muted">No matching symbols</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function RenameSymbol() {
  const open = useStore((s) => s.renameOpen)
  const close = useStore((s) => s.closeRename)
  const rename = useStore((s) => s.renameCurrentSymbol)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(getWordAtCursor() || '')
      setTimeout(() => inputRef.current?.select(), 40)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[57] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Rename symbol">
      <div className="absolute inset-0 bg-black/60" onClick={close} />
      <div className="relative m-3 w-full max-w-sm rounded-2xl border border-border/60 bg-surface p-4 shadow-modal dark:bg-panel">
        <h2 className="mb-3 text-[15px] font-semibold text-ink">Rename symbol</h2>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void rename(value)
            if (e.key === 'Escape') close()
          }}
          className="w-full rounded-xl border border-ink/15 bg-input px-3 py-2.5 font-mono text-[15px] text-ink outline-none focus:border-accent"
        />
        <div className="mt-3 flex gap-2">
          <button onClick={close} className="flex-1 rounded-xl border border-ink/15 py-2.5 text-ink">Cancel</button>
          <button onClick={() => void rename(value)} disabled={!value.trim()} className="flex-1 rounded-xl bg-accent py-2.5 font-semibold text-white disabled:opacity-40">
            Rename
          </button>
        </div>
      </div>
    </div>
  )
}

export function ReferencesPanel() {
  const open = useStore((s) => s.referencesOpen)
  const setOpen = useStore((s) => s.setReferencesOpen)
  const hits = useStore((s) => s.referenceHits)
  const goToLocation = useStore((s) => s.goToLocation)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="References">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="relative m-3 flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-modal dark:bg-panel">
        <div className="flex items-center border-b border-border/50 px-4 py-3">
          <h2 className="flex-1 text-[15px] font-semibold text-ink">{hits.length} reference{hits.length === 1 ? '' : 's'}</h2>
          <button onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted">
            <VscClose />
          </button>
        </div>
        <div className="overflow-y-auto p-1">
          {hits.map((h, i) => (
            <button
              key={`${h.fileId}:${h.line}:${h.col}:${i}`}
              onClick={() => { void goToLocation(h.fileId, h.line, h.col); setOpen(false) }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left active:bg-white/5"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{h.path}</span>
              <span className="text-[11px] text-ink-muted">:{h.line}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
