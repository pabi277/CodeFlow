import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { MdExpandLess, MdExpandMore } from 'react-icons/md'
import { VscClearAll, VscHistory, VscTerminal } from 'react-icons/vsc'

export function TerminalHost() {
  const terminalOpen = useStore((s) => s.terminalOpen)
  const terminalText = useStore((s) => s.terminalText)

  // thin collapsed bar
  if (!terminalOpen) {
    const last = [...terminalText].reverse().find((l) => l.text.trim())
    return (
      <button
        onClick={() => useStore.getState().setTerminalOpen(true)}
        className="flex h-9 w-full items-center gap-2 border-t border-ink/10 bg-surface px-3 text-left text-[12px] text-ink-muted active:bg-white/5 dark:border-white/10"
        aria-label="Expand terminal"
      >
        <MdExpandMore />
        <span className="min-w-0 flex-1 truncate">{last ? last.text : 'Terminal — no output yet'}</span>
      </button>
    )
  }
  return <TerminalPanel />
}

function TerminalPanel() {
  const terminalHeight = useStore((s) => s.terminalHeight)
  const setTerminalHeight = useStore((s) => s.setTerminalHeight)
  const setTerminalOpen = useStore((s) => s.setTerminalOpen)
  const terminalText = useStore((s) => s.terminalText)
  const clearTerminal = useStore((s) => s.clearTerminal)
  const stdin = useStore((s) => s.stdin)
  const setStdin = useStore((s) => s.setStdin)
  const history = useStore((s) => s.history)
  const loadHistory = useStore((s) => s.loadHistory)
  const [showInput, setShowInput] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the bottom whenever new output arrives so results are visible.
  const scrollToBottom = () => {
    const el = outputRef.current
    if (el) el.scrollTop = el.scrollHeight
  }
  useEffect(() => {
    scrollToBottom()
  }, [terminalText])

  const onDragStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const parent = parentRef.current
    if (!parent) return
    dragRef.current = { startY: e.clientY, startH: terminalHeight }
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current || !parent) return
      const delta = dragRef.current.startY - ev.clientY
      const h = dragRef.current.startH + (delta / parent.clientHeight) * 100
      setTerminalHeight(Math.min(85, Math.max(15, h)))
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div ref={parentRef} className="absolute inset-x-0 bottom-0 flex flex-col bg-panel/95 backdrop-blur shadow-modal" style={{ height: `${terminalHeight}%` }}>
      <div
        className="group/term h-1.5 cursor-row-resize touch-none border-b border-border/40 bg-transparent transition-colors hover:bg-accent/60 active:bg-accent/80"
        onPointerDown={onDragStart}
        aria-label="Drag to resize terminal"
      />
      <div className="flex h-10 items-center gap-1 border-b border-border/60 px-2">
        <span className="flex-1 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Terminal</span>
        <TermBtn label="Input" onClick={() => setShowInput((v) => !v)} active={showInput}><VscTerminal /></TermBtn>
        <TermBtn label="History" onClick={() => { setShowHistory((v) => !v); loadHistory() }} active={showHistory}><VscHistory /></TermBtn>
        <TermBtn label="Clear" onClick={clearTerminal}><VscClearAll /></TermBtn>
        <button onClick={() => setTerminalOpen(false)} aria-label="Collapse terminal" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted active:bg-white/10"><MdExpandLess /></button>
      </div>

      {showHistory ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[13px] leading-relaxed">
          {history.length ? (
            history.map((h) => (
              <div key={h.id} className="mb-1 rounded-lg bg-white/5 px-3 py-2">
                <div className="text-[12px] font-medium text-ink">{h.languageName} · {h.status}</div>
                <pre className="mt-1 max-h-24 overflow-hidden whitespace-pre-wrap text-[11px] text-ink-muted">{h.stdout || h.stderr || '(no output)'}</pre>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-[12px] text-ink-muted">No execution history yet</p>
          )}
        </div>
      ) : (
        <div ref={outputRef} className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[13px] leading-relaxed">
          {terminalText.length ? (
            terminalText.map((l) => (
              <div key={l.id} className={`flex items-start gap-2 whitespace-pre-wrap break-words ${
                l.kind === 'stderr' ? 'text-red-400' : l.kind === 'system' ? 'text-ink-muted' : 'text-ink'
              }`}>
                {l.source && <SourceBadge source={l.source} />}
                <span>{l.text || ' '}</span>
              </div>
            ))
          ) : (
            <p className="text-ink-muted">Ready. Press Run to execute the active file.</p>
          )}
        </div>
      )}

      {showInput && (
        <div className="border-t border-border/60 p-3">
          <label className="mb-1 block text-[11px] font-semibold uppercase text-ink-muted">Stdin</label>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={2}
            placeholder="Input passed to your program (e.g. 5\nhello)"
            className="w-full resize-none rounded-lg border border-border/60 bg-black/30 px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-accent placeholder:text-ink-muted/50"
          />
        </div>
      )}
    </div>
  )
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    local: { label: 'Ran locally', cls: 'bg-sky-500/15 text-sky-400' },
    termux: { label: 'Ran in Termux', cls: 'bg-emerald-500/15 text-emerald-400' },
    judge0: { label: 'Ran on Judge0', cls: 'bg-purple-500/15 text-purple-400' },
    mock: { label: 'Mock output', cls: 'bg-white/10 text-ink-muted' },
  }
  const s = map[source] || { label: source, cls: 'bg-white/10 text-ink-muted' }
  return (
    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.label}</span>
  )
}

function TermBtn({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} className={`flex h-9 w-9 items-center justify-center rounded-lg active:bg-white/10 ${active ? 'text-accent' : 'text-ink-muted'}`}>
      {children}
    </button>
  )
}
