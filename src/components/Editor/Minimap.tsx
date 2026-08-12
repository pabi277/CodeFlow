import { useEffect, useRef } from 'react'
import { getEditor } from '../../utils/editorApi'
import { useStore } from '../../store/useStore'

/** Canvas minimap — entire file scaled to the gutter, click/drag to scroll. */
export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeTabId = useStore((s) => s.activeTabId)
  const content = useStore((s) => (s.activeTabId ? s.nodeMap[s.activeTabId]?.content : '') || '')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let raf = 0
    let dragging = false

    const paint = () => {
      const view = getEditor()
      if (!view) return
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.clientWidth
      const cssH = canvas.clientHeight
      if (cssW === 0 || cssH === 0) return
      if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
        canvas.width = Math.floor(cssW * dpr)
        canvas.height = Math.floor(cssH * dpr)
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)

      const lines = content.split('\n')
      const rowH = Math.max(1.15, cssH / Math.max(lines.length, 1))
      const styles = getComputedStyle(canvas)
      const ink = styles.color || '#cdd6f4'
      const accent = styles.getPropertyValue('--accent').trim() || '#89b4fa'

      ctx.fillStyle = ink
      const maxLines = Math.min(lines.length, Math.ceil(cssH / rowH) + 2)
      for (let i = 0; i < maxLines; i++) {
        const line = lines[i]
        if (!line || !line.trim()) continue
        const indent = (line.match(/^\s*/) || [''])[0].length
        const y = i * rowH
        const x = 3 + indent * 0.55
        const w = Math.min(cssW - x - 3, 3 + line.trim().length * 0.65)
        ctx.globalAlpha = /^\s*(#|\/\/|\/\*|\*)/.test(line) ? 0.22 : 0.42
        ctx.fillRect(x, y, w, Math.max(1, rowH - 0.35))
      }

      const scroll = view.scrollDOM
      const denom = Math.max(1, scroll.scrollHeight)
      const vy = (scroll.scrollTop / denom) * cssH
      const vh = Math.max(10, (scroll.clientHeight / denom) * cssH)
      ctx.globalAlpha = 0.2
      ctx.fillStyle = accent
      ctx.fillRect(0, vy, cssW, vh)
      ctx.globalAlpha = 0.55
      ctx.strokeStyle = accent
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, vy + 0.5, cssW - 1, Math.max(1, vh - 1))
      ctx.globalAlpha = 1
    }

    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(paint)
    }

    const scrollTo = (clientY: number) => {
      const view = getEditor()
      if (!view) return
      const rect = canvas.getBoundingClientRect()
      const y = Math.min(Math.max(0, clientY - rect.top), rect.height)
      const scroll = view.scrollDOM
      const max = Math.max(0, scroll.scrollHeight - scroll.clientHeight)
      scroll.scrollTop = (y / Math.max(1, rect.height)) * max
      schedule()
    }

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      canvas.setPointerCapture(e.pointerId)
      scrollTo(e.clientY)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (dragging) scrollTo(e.clientY)
    }
    const onPointerUp = () => { dragging = false }

    const view = getEditor()
    view?.scrollDOM.addEventListener('scroll', schedule, { passive: true })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('resize', schedule)
    schedule()

    return () => {
      cancelAnimationFrame(raf)
      view?.scrollDOM.removeEventListener('scroll', schedule)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('resize', schedule)
    }
  }, [activeTabId, content])

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-14 shrink-0 cursor-pointer touch-none border-l border-border/40 bg-black/10 text-ink"
      aria-label="Code minimap"
      role="scrollbar"
    />
  )
}
