import { useMemo } from 'react'
import { isHtmlPreview, renderMarkdown } from '../../utils/markdown'
import { buildHtmlPreview, filesFromNodeMap } from '../../utils/htmlPreview'
import { useStore } from '../../store/useStore'

interface Props {
  content: string
  path: string
}

export function Preview({ content, path }: Props) {
  const nodeMap = useStore((s) => s.nodeMap)
  const files = useMemo(() => filesFromNodeMap(nodeMap), [nodeMap])

  const bundled = useMemo(() => {
    if (!isHtmlPreview(path)) return null
    return buildHtmlPreview(content, path, files)
  }, [content, path, files])

  const markdown = useMemo(() => (isHtmlPreview(path) ? '' : renderMarkdown(content)), [content, path])

  if (isHtmlPreview(path) && bundled) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {bundled.missing.length > 0 && (
          <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
            Missing {bundled.missing.length === 1 ? 'file' : 'files'}: {bundled.missing.join(', ')}
          </div>
        )}
        <iframe
          title="HTML preview"
          sandbox="allow-scripts allow-forms allow-modals"
          srcDoc={bundled.html}
          className="min-h-0 w-full flex-1 border-0 bg-white"
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      {content.trim() ? (
        <article className="md-preview" dangerouslySetInnerHTML={{ __html: markdown }} />
      ) : (
        <p className="py-10 text-center text-[13px] text-ink-muted">Nothing to preview yet.</p>
      )}
    </div>
  )
}
