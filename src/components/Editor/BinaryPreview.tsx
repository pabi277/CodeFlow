import { useEffect, useState } from 'react'
import { imageSrcFromContent, isImagePath, mimeForPath } from '../../utils/binary'

export function BinaryPreview({ path, content }: { path: string; content: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const next = imageSrcFromContent(content, path)
    setSrc(next)
    return () => {
      if (next && next.startsWith('blob:')) URL.revokeObjectURL(next)
    }
  }, [path, content])

  if (isImagePath(path) || content.startsWith('data:image') || path.endsWith('.svg')) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 overflow-auto bg-black/20 p-6">
        {src ? (
          <img src={src} alt={path} className="max-h-full max-w-full rounded-lg shadow-lg" />
        ) : (
          <p className="text-sm text-ink-muted">Could not preview this image.</p>
        )}
        <p className="text-[12px] text-ink-muted">{path} · {mimeForPath(path)}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm font-medium text-ink">Binary file</p>
      <p className="max-w-xs text-[12px] text-ink-muted">
        {path} looks like a binary asset and is not opened as text. Import images via ZIP or the file picker to preview them.
      </p>
    </div>
  )
}
