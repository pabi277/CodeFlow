import type { ReactNode } from 'react'
import { VscClose } from 'react-icons/vsc'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  full?: boolean
}

export function BottomSheet({ open, onClose, title, children, full }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[50] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative mx-auto flex w-full flex-col rounded-t-2xl border border-b-0 border-border/60 bg-surface shadow-modal animate-sheet-up ${
          full ? 'h-[92dvh]' : 'max-h-[85dvh]'
        }`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted active:bg-black/10 dark:active:bg-white/10">
              <VscClose size={20} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
