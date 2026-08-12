import { useStore } from '../../store/useStore'
import { BottomSheet } from '../Shared/BottomSheet'
import { FiGitBranch, FiCheck } from 'react-icons/fi'

export function BranchPicker() {
  const open = useStore((s) => s.branchPickerOpen)
  const close = useStore((s) => s.closeBranchPicker)
  const branches = useStore((s) => s.branches)
  const doSwitchBranch = useStore((s) => s.doSwitchBranch)
  const project = useStore((s) => s.projects.find((p) => p.id === s.activeProjectId))
  const current = project?.github.branch

  return (
    <BottomSheet open={open} onClose={close} title="Switch branch">
      <div className="pb-2">
        {branches.length ? (
          branches.map((b) => (
            <button
              key={b.name}
              onClick={() => doSwitchBranch(b.name)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[14px] text-ink active:bg-white/5"
            >
              <span className="text-ink-muted"><FiGitBranch /></span>
              <span className="flex-1">{b.name}</span>
              {b.name === current && <FiCheck className="text-accent" />}
            </button>
          ))
        ) : (
          <p className="py-8 text-center text-[13px] text-ink-muted">No branches found</p>
        )}
      </div>
    </BottomSheet>
  )
}
