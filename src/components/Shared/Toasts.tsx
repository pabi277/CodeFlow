import { useStore } from '../../store/useStore'
import { AiOutlineCheckCircle, AiOutlineCloseCircle, AiOutlineWarning, AiOutlineInfoCircle } from 'react-icons/ai'
import { VscClose } from 'react-icons/vsc'

const STYLES = {
  success: { border: 'border-emerald-500', icon: AiOutlineCheckCircle, iconColor: 'text-emerald-500' },
  error: { border: 'border-red-500', icon: AiOutlineCloseCircle, iconColor: 'text-red-500' },
  warning: { border: 'border-amber-500', icon: AiOutlineWarning, iconColor: 'text-amber-500' },
  info: { border: 'border-sky-500', icon: AiOutlineInfoCircle, iconColor: 'text-sky-500' },
} as const

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const s = STYLES[t.type] || STYLES.info
        const Icon = s.icon
        return (
          <div
            key={t.id}
            role="status"
            className={`glass pointer-events-auto relative flex w-full max-w-sm items-center gap-3 rounded-xl border border-border/40 border-l-4 ${s.border} py-3 pl-4 pr-10 text-sm text-ink shadow-modal animate-toast-in`}
          >
            <Icon className={`shrink-0 ${s.iconColor}`} size={20} />
            <span className="min-w-0 flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded text-ink-muted active:bg-black/5 dark:active:bg-white/10"
            >
              <VscClose />
            </button>
          </div>
        )
      })}
    </div>
  )
}
