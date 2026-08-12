import { useEffect, useState } from 'react'

/**
 * Tracks how much of the screen the on-screen (soft) keyboard is covering,
 * using the Visual Viewport API. Returns the keyboard height in px (0 when the
 * keyboard is closed). This lets UI position itself above the keyboard even on
 * Android browsers that overlay the layout instead of resizing it.
 */
export function useKeyboardHeight(): number {
  const [kbHeight, setKbHeight] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      // When the keyboard is open, the visual viewport shrinks.
      const height = window.innerHeight - vv.height
      // Guard against tiny/false deltas (some browsers report 1-2px jitter).
      setKbHeight(height > 1 ? height : 0)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return kbHeight
}
