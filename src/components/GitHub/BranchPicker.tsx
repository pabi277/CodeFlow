import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { BottomSheet } from '../Shared/BottomSheet'
import { FiGitBranch, FiCheck, FiTrash2 } from 'react-icons/fi'

export function BranchPicker() {
  const open = useStore((s) => s.branchPickerOpen)
  const close = useStore((s) => s.closeBranchPicker)
  const branches = useStore((s) => s.branches)
  const doSwitchBranch = useStore((s) => s.doSwitchBranch)
  const doCreateBranch = useStore((s) => s.doCreateBranch)
  const doDeleteBranch = useStore((s) => s.doDeleteBranch)
  const project = useStore((s) => s.projects.find((p) => p.id === s.activeProjectId))
  const current = project?.github.branch
  const [name, setName] = useState('')

  return (
    <BottomSheet open={open} onClose={close} title="Branches">
      <div className="pb-2">
        <div className="flex gap-2 px-4 pb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                void doCreateBranch(name.trim())
                setName('')
              }
            }}
            placeholder="New branch name"
            className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-input px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
          />
          <button
            onClick={() => { if (name.trim()) { void doCreateBranch(name.trim()); setName('') } }}
            disabled={!name.trim()}
            className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            Create
          </button>
        </div>
        {branches.length ? (
          branches.map((b) => (
            <div key={b.name} className="flex items-center">
              <button
                onClick={() => doSwitchBranch(b.name)}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left text-[14px] text-ink active:bg-white/5"
              >
                <span className="text-ink-muted"><FiGitBranch /></span>
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                {b.name === current && <FiCheck className="text-accent" />}
              </button>
              {b.name !== current && (
                <button
                  onClick={() => { if (window.confirm(`Delete branch “${b.name}”?`)) void doDeleteBranch(b.name) }}
                  aria-label={`Delete ${b.name}`}
                  className="mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-red-400 active:bg-white/5"
                >
                  <FiTrash2 />
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-[13px] text-ink-muted">No branches found</p>
        )}
      </div>
    </BottomSheet>
  )
}
