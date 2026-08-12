import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Catches any render-time error so the user never sees a blank screen.
 * Shows the actual error message so it can be reported/diagnosed.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('[CodeFlow] render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface p-6 text-center">
          <div className="text-2xl">Something went wrong</div>
          <div className="max-w-md overflow-auto rounded-lg bg-red-500/10 p-4 font-mono text-[12px] text-red-400">
            {this.state.error.message}
          </div>
          <div className="text-[13px] text-ink-muted">Tap reload. If it persists, copy the error above.</div>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-white"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
