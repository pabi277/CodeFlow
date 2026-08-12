import { useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { MdExpandLess, MdExpandMore } from 'react-icons/md'
import { VscClearAll, VscHistory, VscTerminal, VscError, VscListTree } from 'react-icons/vsc'
import { ProblemsPanel } from '../ProblemsPanel'
import { OutlinePanel } from '../OutlinePanel'
import type { BottomPanelTab } from '../../types'

export function TerminalHost() {
  const terminalOpen = useStore((s) => s.terminalOpen)
  const terminalText = useStore((s) => s.terminalText)
  const diagnostics = useStore((s) => s.diagnostics)
  const openBottomPanel = useStore((s) => s.openBottomPanel)

  // thin collapsed bar
  if (!terminalOpen) {
    const last = [...terminalText].reverse().find((l) => l.text.trim())
    const errors = diagnostics.filter((d) => d.severity === 'error').length
    return (
      <button
        onClick={() => openBottomPanel('terminal')}
        className="flex h-9 w-full items-center gap-2 border-t border-ink/10 bg-surface px-3 text-left text-[12px] text-ink-muted active:bg-white/5 dark:border-white/10"
        aria-label="Expand panel"
      >
        <MdExpandMore />
        <span className="min-w-0 flex-1 truncate">{last ? last.text : 'Terminal — no output yet'}</span>
        {errors > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <VscError /> {errors}
          </span>
        )}
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
  const tab = useStore((s) => s.bottomPanelTab)
  const setTab = useStore((s) => s.setBottomPanelTab)
  const diagnostics = useStore((s) => s.diagnostics)
  const [showInput, setShowInput] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)

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

  const errors = diagnostics.filter((d) => d.severity === 'error').length

  return (
    <div ref={parentRef} className="absolute inset-x-0 bottom-0 flex flex-col bg-panel/95 backdrop-blur shadow-modal" style={{ height: `${terminalHeight}%` }}>
      <div
        className="group/term h-1.5 cursor-row-resize touch-none border-b border-border/40 bg-transparent transition-colors hover:bg-accent/60 active:bg-accent/80"
        onPointerDown={onDragStart}
        aria-label="Drag to resize panel"
      />
      <div className="flex h-10 items-center gap-1 border-b border-border/60 px-1">
        <PanelTab id="terminal" current={tab} onSelect={setTab} icon={<VscTerminal />} label="Terminal" />
        <PanelTab id="problems" current={tab} onSelect={setTab} icon={<VscError />} label={errors ? `Problems ${errors}` : 'Problems'} badge={errors > 0} />
        <PanelTab id="outline" current={tab} onSelect={setTab} icon={<VscListTree />} label="Outline" />
        <span className="flex-1" />
        {tab === 'terminal' && (
          <>
            <TermBtn label="Input" onClick={() => setShowInput((v) => !v)} active={showInput}><VscTerminal /></TermBtn>
            <TermBtn label="History" onClick={() => { setShowHistory((v) => !v); loadHistory() }} active={showHistory}><VscHistory /></TermBtn>
            <TermBtn label="Clear" onClick={clearTerminal}><VscClearAll /></TermBtn>
          </>
        )}
        <button onClick={() => setTerminalOpen(false)} aria-label="Collapse panel" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted active:bg-white/10"><MdExpandLess /></button>
      </div>

      {tab === 'problems' ? (
        <div className="min-h-0 flex-1"><ProblemsPanel /></div>
      ) : tab === 'outline' ? (
        <div className="min-h-0 flex-1"><OutlinePanel /></div>
      ) : showHistory ? (
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

      {tab === 'terminal' && showInput && (
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

function PanelTab({ id, current, onSelect, icon, label, badge }: {
  id: BottomPanelTab
  current: BottomPanelTab
  onSelect: (t: BottomPanelTab) => void
  icon: React.ReactNode
  label: string
  badge?: boolean
}) {
  const active = current === id
  return (
    <button
      onClick={() => onSelect(id)}
      className={`flex h-full items-center gap-1.5 border-b-2 px-2.5 text-[12px] font-medium ${
        active ? 'border-accent text-ink' : 'border-transparent text-ink-muted'
      } ${badge && !active ? 'text-red-400' : ''}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
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
