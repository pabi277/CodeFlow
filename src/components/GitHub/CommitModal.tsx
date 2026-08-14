import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { BottomSheet } from '../Shared/BottomSheet'
import { FiGitCommit } from 'react-icons/fi'

const STATUS_LABEL: Record<string, string> = {
  modified: 'M',
  new: 'A',
  deleted: 'D',
}
const STATUS_COLOR: Record<string, string> = {
  modified: 'text-yellow-400',
  new: 'text-emerald-400',
  deleted: 'text-red-400',
}

export function CommitModal() {
  const open = useStore((s) => s.commitOpen)
  const close = useStore((s) => s.closeCommit)
  const gitStatus = useStore((s) => s.gitStatus)
  const doCommit = useStore((s) => s.doCommit)
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // reset selection each time the sheet opens
  useEffect(() => {
    if (open) {
      setMessage('')
      setSelected(new Set(gitStatus.map((g) => g.id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const ids = Array.from(selected)

  return (
    <BottomSheet open={open} onClose={close} title="Commit changes">
      <div className="p-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="Commit message (required)…"
          className="w-full resize-none rounded-xl border border-ink/15 bg-input px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
        />
        <p className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Files to commit ({ids.length})</p>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {gitStatus.length ? (
            gitStatus.map((g) => (
              <label key={g.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 active:bg-white/5">
                <input
                  type="checkbox"
                  checked={selected.has(g.id)}
                  onChange={() => toggle(g.id)}
                  className="h-5 w-5 accent-[var(--accent)]"
                />
                <span className={`w-5 text-center text-[13px] font-bold ${STATUS_COLOR[g.status]}`}>{STATUS_LABEL[g.status]}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{g.path}</span>
              </label>
            ))
          ) : (
            <p className="py-4 text-center text-[13px] text-ink-muted">No changes to commit</p>
          )}
        </div>
        <div className="mt-4">
          <button
            onClick={() => doCommit(message, ids, true)}
            disabled={!message.trim() || !ids.length}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-white disabled:opacity-40 disabled:shadow-none"
          >
            <FiGitCommit /> Commit &amp; Push
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
