import type { ReactNode, ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  label: string
  active?: boolean
}

export function IconButton({ children, label, active, className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex h-11 w-11 min-w-11 items-center justify-center rounded-lg text-[18px] transition-all duration-150 hover:text-ink active:scale-95 active:bg-black/10 dark:active:bg-white/10 ${
        active ? 'text-accent drop-shadow-[0_0_6px_color-mix(in_srgb,var(--accent)_60%,transparent)]' : 'text-ink-muted'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
