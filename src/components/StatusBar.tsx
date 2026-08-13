import { useStore } from '../store/useStore'
import { detectLanguage, languageName } from '../utils/language'
import { detectLineEnding, lineEndingLabel, type LineEnding } from '../utils/lineEnding'
import { isBinaryPath, isDataUrl, isImagePath } from '../utils/binary'
import { VscError, VscWarning } from 'react-icons/vsc'

export function StatusBar() {
  const enabled = useStore((s) => s.settings.showStatusBar)
  const cursorPos = useStore((s) => s.cursorPos)
  const activeTabId = useStore((s) => s.activeTabId)
  const nodeMap = useStore((s) => s.nodeMap)
  const settings = useStore((s) => s.settings)
  const diagnostics = useStore((s) => s.diagnostics)
  const setGoToLineOpen = useStore((s) => s.setGoToLineOpen)
  const openBottomPanel = useStore((s) => s.openBottomPanel)

  if (!enabled) return null

  const file = activeTabId ? nodeMap[activeTabId] : undefined
  const lang = file ? languageName(detectLanguage(file.path)) : '—'
  const errors = diagnostics.filter((d) => d.severity === 'error').length
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length
  const indent = settings.indentWithSpaces ? `Spaces: ${settings.tabSize}` : `Tabs: ${settings.tabSize}`
  const ending = file ? detectLineEnding(file.content) : 'lf'
  const binary = !!file && (isBinaryPath(file.path) || isImagePath(file.path) || isDataUrl(file.content))
  const encodingLabel = binary ? 'Binary' : 'UTF-8'
  const cycleEnding = () => {
    const order: LineEnding[] = ['lf', 'crlf', 'cr']
    const next = order[(order.indexOf(ending) + 1) % order.length]
    useStore.getState().convertActiveLineEnding(next)
  }

  return (
    <footer role="status" className="flex h-6 shrink-0 items-center gap-3 overflow-x-auto border-t border-border/50 bg-surface px-2 text-[11px] text-ink-muted dark:bg-panel [scrollbar-width:none]">
      <button onClick={() => setGoToLineOpen(true)} className="shrink-0 rounded px-1 hover:text-ink" aria-label="Go to line">
        Ln {cursorPos.line}, Col {cursorPos.col}
      </button>
      <span className="shrink-0">{lang}</span>
      <span className="shrink-0">{indent}</span>
      <button onClick={cycleEnding} className="shrink-0 rounded px-1 hover:text-ink" aria-label="Toggle line ending">
        {lineEndingLabel(ending)}
      </button>
      <span className="shrink-0" title={binary ? 'Binary file' : 'File encoding'}>
        {encodingLabel}
      </span>
      <button
        onClick={() => openBottomPanel('problems')}
        className="ml-auto flex shrink-0 items-center gap-2 rounded px-1 hover:text-ink"
        aria-label="Show problems"
      >
        <span className={`flex items-center gap-0.5 ${errors ? 'text-red-400' : ''}`}>
          <VscError size={12} /> {errors}
        </span>
        <span className={`flex items-center gap-0.5 ${warnings ? 'text-amber-400' : ''}`}>
          <VscWarning size={12} /> {warnings}
        </span>
      </button>
    </footer>
  )
}
