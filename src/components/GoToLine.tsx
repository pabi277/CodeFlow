import { useStore } from '../store/useStore'
import { NameModal } from './Shared/NameModal'
import { getCursorPosition, goToPosition, parseLineCol } from '../utils/editorApi'

export function GoToLine() {
  const open = useStore((s) => s.goToLineOpen)
  const setOpen = useStore((s) => s.setGoToLineOpen)
  const showToast = useStore((s) => s.showToast)
  const cursor = getCursorPosition()

  return (
    <NameModal
      open={open}
      title="Go to line"
      initial={`${cursor.line}`}
      placeholder="line or line:column"
      submitLabel="Go"
      onClose={() => setOpen(false)}
      onSubmit={(value) => {
        const parsed = parseLineCol(value)
        if (!parsed) {
          showToast('Enter a line number, e.g. 42 or 42:8', 'error')
          return
        }
        goToPosition(parsed.line, parsed.col)
      }}
    />
  )
}
