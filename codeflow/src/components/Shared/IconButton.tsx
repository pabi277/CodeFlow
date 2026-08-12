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
      className={`flex h-11 w-11 min-w-11 items-center justify-center rounded-lg text-[18px] transition-colors active:bg-black/10 dark:active:bg-white/10 ${
        active ? 'text-accent' : 'text-ink-muted'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
