import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { searchInFiles } from '../utils/projectSearch'
import { FiSearch, FiFile, FiX } from 'react-icons/fi'

export function FindInProject() {
  const open = useStore((s) => s.findInProjectOpen)
  const setOpen = useStore((s) => s.setFindInProject)
  const nodeMap = useStore((s) => s.nodeMap)
  const goToLocation = useStore((s) => s.goToLocation)
  const replaceInProject = useStore((s) => s.replaceInProject)
  const showToast = useStore((s) => s.showToast)
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setReplacement('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const results = useMemo(() => {
    if (!query.trim()) return []
    return searchInFiles(Object.values(nodeMap), query, { matchCase, regex: useRegex, wholeWord })
  }, [query, matchCase, useRegex, wholeWord, nodeMap])

  if (!open) return null

  const replaceAll = async () => {
    if (!query.trim()) return
    const n = await replaceInProject(query, replacement, { matchCase, regex: useRegex, wholeWord })
    showToast(n ? `Replaced ${n} match${n === 1 ? '' : 'es'}` : 'No matches to replace', n ? 'success' : 'info')
  }

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-surface animate-drawer-in dark:bg-panel" role="dialog" aria-label="Find in project">
      <div className="border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2">
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
          <button onClick={() => setMatchCase((v) => !v)} className={`rounded-lg px-2.5 py-2 text-[11px] font-semibold ${matchCase ? 'bg-accent text-white' : 'bg-input text-ink-muted'}`} aria-label="Match case">Aa</button>
          <button onClick={() => setUseRegex((v) => !v)} className={`rounded-lg px-2.5 py-2 text-[11px] font-semibold ${useRegex ? 'bg-accent text-white' : 'bg-input text-ink-muted'}`} aria-label="Regular expression">.*</button>
          <button onClick={() => setWholeWord((v) => !v)} className={`rounded-lg px-2.5 py-2 text-[11px] font-semibold ${wholeWord ? 'bg-accent text-white' : 'bg-input text-ink-muted'}`} aria-label="Whole word">W</button>
          <button onClick={() => setShowReplace((v) => !v)} className={`rounded-lg px-2.5 py-2 text-[11px] font-semibold ${showReplace ? 'bg-accent text-white' : 'bg-input text-ink-muted'}`}>Replace</button>
          <button onClick={() => setOpen(false)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted active:bg-white/10">
            <FiX />
          </button>
        </div>
        {showReplace && (
          <div className="mt-2 flex items-center gap-2">
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Replace with…"
              className="flex-1 rounded-lg bg-input px-3 py-2 text-[14px] text-ink outline-none"
            />
            <button onClick={() => void replaceAll()} className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white">
              Replace all
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-6">
        {query.trim() ? (
          results.length ? (
            results.map((r, i) => (
              <button
                key={`${r.id}-${i}`}
                onClick={() => { void goToLocation(r.id, r.lineNo, 1); setOpen(false) }}
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
          <p className="py-8 text-center text-[13px] text-ink-muted">Type to search. Use .* for regex, W for whole word, Replace to rewrite matches.</p>
        )}
      </div>
    </div>
  )
}
