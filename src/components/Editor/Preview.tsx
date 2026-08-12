import { useMemo } from 'react'
import { isHtmlPreview, renderMarkdown } from '../../utils/markdown'

interface Props {
  content: string
  path: string
}

export function Preview({ content, path }: Props) {
  const html = useMemo(() => (isHtmlPreview(path) ? content : renderMarkdown(content)), [content, path])

  if (isHtmlPreview(path)) {
    return (
      <iframe
        title="HTML preview"
        sandbox="allow-scripts allow-forms allow-modals"
        srcDoc={html}
        className="h-full w-full border-0 bg-white"
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      {content.trim() ? (
        <article className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="py-10 text-center text-[13px] text-ink-muted">Nothing to preview yet.</p>
      )}
    </div>
  )
}
