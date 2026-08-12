import { useStore } from '../store/useStore'
import { formatTimeMs } from '../utils/format'
import { FiChevronLeft, FiX, FiPlay } from 'react-icons/fi'

export function ExecutionHistory() {
  const open = useStore((s) => s.historyBrowserOpen)
  const close = useStore((s) => s.setHistoryBrowser)
  const history = useStore((s) => s.history)
  const openFile = useStore((s) => s.openFile)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const runCurrentFile = useStore((s) => s.runCurrentFile)
  const clearTerminal = useStore((s) => s.clearTerminal)

  if (!open) return null

  const statusColor: Record<string, string> = {
    accepted: 'text-emerald-400', wrong_answer: 'text-red-400',
    time_limit_exceeded: 'text-amber-400', runtime_error: 'text-red-400',
    compile_error: 'text-orange-400', system_error: 'text-ink-muted',
  }

  const rerun = (id: string) => {
    openFile(id)
    setActiveTab(id)
    clearTerminal()
    runCurrentFile()
    close(false)
  }

  return (
    <div className="fixed inset-0 z-[50] flex flex-col bg-surface animate-drawer-in dark:bg-panel" role="dialog" aria-label="Execution history">
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-2">
        <button onClick={() => close(false)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink active:bg-black/5 dark:active:bg-white/5">
          <FiChevronLeft />
        </button>
        <h1 className="flex-1 text-lg font-semibold text-ink">Execution History</h1>
        <button onClick={() => close(false)} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted active:bg-black/5 dark:active:bg-white/5">
          <FiX />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-24">
        {history.length ? (
          history.map((h) => (
            <div key={h.id} className="mb-2 rounded-xl bg-white/5 p-3">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase ${statusColor[h.status]}`}>{h.status.replace(/_/g, ' ')}</span>
                <span className="flex-1 truncate text-[13px] font-medium text-ink">{h.languageName}</span>
                <span className="text-[11px] text-ink-muted">{formatTimeMs(h.timeMs)}</span>
              </div>
              {h.stdout && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-black/20 p-2 text-[11px] text-ink">{h.stdout}</pre>}
              {h.stderr && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-black/20 p-2 text-[11px] text-red-400">{h.stderr}</pre>}
              <div className="mt-2 flex items-center justify-between">
                <button onClick={() => rerun(h.fileId)} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white active:opacity-90">
                  <FiPlay /> Rerun
                </button>
                <span className="text-[11px] text-ink-muted">{new Date(h.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="py-10 text-center text-[13px] text-ink-muted">No executions yet. Run some code first.</p>
        )}
      </div>
    </div>
  )
}
