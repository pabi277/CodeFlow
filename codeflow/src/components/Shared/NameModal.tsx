import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'

interface Props {
  open: boolean
  title: string
  initial?: string
  placeholder?: string
  submitLabel?: string
  onClose: () => void
  onSubmit: (value: string) => void
}

export function NameModal({ open, title, initial = '', placeholder, submitLabel = 'Create', onClose, onSubmit }: Props) {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    if (open) setValue(initial)
  }, [open, initial])

  const submit = () => {
    const v = value.trim()
    if (!v) return
    onSubmit(v)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="p-4">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={placeholder}
          className="w-full rounded-xl border border-ink/15 bg-input px-4 py-3 text-[16px] text-ink outline-none focus:border-accent"
        />
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-ink/15 px-4 py-3 text-ink active:bg-black/5 dark:active:bg-white/5">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="flex-1 rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-40"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
