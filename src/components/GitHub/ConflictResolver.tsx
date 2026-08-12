import { useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { computeUnifiedDiff } from '../../utils/diff'
import { FiChevronLeft } from 'react-icons/fi'

export function ConflictResolver() {
  const conflictFileId = useStore((s) => s.conflictFileId)
  const conflicts = useStore((s) => s.gitConflicts)
  const close = useStore((s) => s.closeConflict)
  const resolve = useStore((s) => s.resolveConflict)
  const conflict = conflicts.find((c) => c.fileId === conflictFileId)

  const diff = useMemo(() => {
    if (!conflict) return []
    return computeUnifiedDiff(conflict.remote, conflict.local)
  }, [conflict])

  if (!conflict) return null

  return (
    <div className="fixed inset-0 z-[46] flex flex-col bg-surface animate-drawer-in dark:bg-panel" role="dialog" aria-label="Resolve conflict">
      <div className="flex items-center gap-1 border-b border-ink/10 px-2 py-2 dark:border-white/10">
        <button onClick={close} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink active:bg-black/5 dark:active:bg-white/5">
          <FiChevronLeft />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink">Merge conflict</div>
          <div className="truncate text-[11px] text-ink-muted">{conflict.path}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-border/40 p-2">
        <button onClick={() => void resolve(conflict.fileId, 'local')} className="rounded-lg bg-amber-500/15 px-3 py-2 text-[12px] font-semibold text-amber-300 active:opacity-80">
          Keep local
        </button>
        <button onClick={() => void resolve(conflict.fileId, 'remote')} className="rounded-lg bg-sky-500/15 px-3 py-2 text-[12px] font-semibold text-sky-300 active:opacity-80">
          Keep incoming
        </button>
        <button
          onClick={() => void resolve(conflict.fileId, 'both')}
          className="col-span-2 rounded-lg bg-white/5 px-3 py-2 text-[12px] font-medium text-ink active:opacity-80"
        >
          Keep both (conflict markers)
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[12px] leading-relaxed">
        <div className="mb-2 flex items-center gap-3 text-[11px] text-ink-muted">
          <span className="text-emerald-400">+ local</span>
          <span className="text-red-400">− incoming</span>
        </div>
        {diff.map((l, i) => (
          <div
            key={i}
            className={`flex whitespace-pre-wrap break-all px-2 ${
              l.type === 'add' ? 'bg-emerald-500/15 text-emerald-300'
              : l.type === 'del' ? 'bg-red-500/15 text-red-300'
              : 'text-ink-muted'
            }`}
          >
            <span className="mr-2 w-4 shrink-0 select-none">{l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}</span>
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
