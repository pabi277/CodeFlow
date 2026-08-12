import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { VscError, VscWarning, VscInfo } from 'react-icons/vsc'
import type { DiagnosticSeverity } from '../types'

export function ProblemsPanel() {
  const diagnostics = useStore((s) => s.diagnostics)
  const goToLocation = useStore((s) => s.goToLocation)
  const [filter, setFilter] = useState<'all' | DiagnosticSeverity>('all')

  const list = useMemo(
    () => (filter === 'all' ? diagnostics : diagnostics.filter((d) => d.severity === filter)),
    [diagnostics, filter],
  )
  const errors = diagnostics.filter((d) => d.severity === 'error').length
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-border/40 px-2 py-1 text-[11px]">
        {(['all', 'error', 'warning'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded px-2 py-1 capitalize ${filter === f ? 'bg-accent/15 text-accent' : 'text-ink-muted'}`}
          >
            {f === 'all' ? `All ${diagnostics.length}` : f === 'error' ? `Errors ${errors}` : `Warnings ${warnings}`}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length ? (
          list.map((d) => (
            <button
              key={d.id}
              onClick={() => goToLocation(d.fileId, d.line, d.col)}
              className="flex w-full items-start gap-2 px-3 py-1.5 text-left active:bg-white/5"
            >
              <span className="mt-0.5 shrink-0">
                {d.severity === 'error' ? <VscError className="text-red-400" /> : d.severity === 'warning' ? <VscWarning className="text-amber-400" /> : <VscInfo className="text-sky-400" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-ink">{d.message}</span>
                <span className="block truncate text-[11px] text-ink-muted">
                  {d.path.slice(1)}:{d.line}:{d.col} · {d.source}
                </span>
              </span>
            </button>
          ))
        ) : (
          <p className="px-3 py-6 text-center text-[12px] text-ink-muted">No problems detected in this project.</p>
        )}
      </div>
    </div>
  )
}
