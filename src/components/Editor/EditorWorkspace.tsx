import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { isPreviewable } from '../../utils/markdown'
import { Editor } from './Editor'
import { Preview } from './Preview'
import { TerminalHost } from '../Terminal/Terminal'

export function EditorWorkspace() {
  const zenMode = useStore((s) => s.zenMode)
  const previewMode = useStore((s) => s.previewMode)
  const activeTabId = useStore((s) => s.activeTabId)
  const nodeMap = useStore((s) => s.nodeMap)
  const file = activeTabId ? nodeMap[activeTabId] : undefined
  const previewable = !!(file && isPreviewable(file.path))
  const showEditor = !previewable || previewMode !== 'preview'
  const showPreview = previewable && previewMode !== 'editor'
  const split = showEditor && showPreview
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 720)

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 720)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={`flex min-h-0 flex-1 ${split && wide ? 'flex-row' : 'flex-col'}`}>
        <div className={`relative min-h-0 min-w-0 ${showEditor ? 'flex-1' : 'hidden'}`}>
          <Editor />
        </div>
        {showPreview && file && (
          <div
            className={`min-h-0 min-w-0 flex-1 bg-surface dark:bg-panel ${
              split ? (wide ? 'border-l border-border/60' : 'border-t border-border/60') : ''
            }`}
          >
            <Preview content={file.content} path={file.path} />
          </div>
        )}
      </div>
      {!zenMode && <TerminalHost />}
    </div>
  )
}
