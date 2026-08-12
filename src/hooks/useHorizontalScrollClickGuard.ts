import { useCallback, useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react'

const DEFAULT_THRESHOLD = 10

type TouchClickGuardHandlers = {
  onTouchStart: (event: ReactTouchEvent<HTMLElement>) => void
  onTouchMove: (event: ReactTouchEvent<HTMLElement>) => void
  onTouchEnd: () => void
  onTouchCancel: () => void
  onClickCapture: (event: ReactMouseEvent<HTMLElement>) => void
}

/**
 * Prevent the synthetic click that mobile browsers emit after a horizontal
 * swipe from activating an item in a scrollable bar.
 *
 * The guard lives on the scroll container so it also covers nested buttons
 * such as a tab's close button. A tap is left completely untouched; only a
 * horizontal movement greater than the threshold consumes the next click.
 */
export function useHorizontalScrollClickGuard(threshold = DEFAULT_THRESHOLD): TouchClickGuardHandlers {
  const startX = useRef<number | null>(null)
  const moved = useRef(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearResetTimer = useCallback(() => {
    if (resetTimer.current !== null) {
      clearTimeout(resetTimer.current)
      resetTimer.current = null
    }
  }, [])

  const reset = useCallback(() => {
    startX.current = null
    moved.current = false
    clearResetTimer()
  }, [clearResetTimer])

  const deferReset = useCallback(() => {
    clearResetTimer()
    resetTimer.current = setTimeout(reset, 500)
  }, [clearResetTimer, reset])

  const onTouchStart = useCallback((event: ReactTouchEvent<HTMLElement>) => {
    clearResetTimer()
    if (event.touches.length !== 1) {
      startX.current = null
      moved.current = false
      return
    }
    startX.current = event.touches[0].clientX
    moved.current = false
  }, [clearResetTimer])

  const onTouchMove = useCallback((event: ReactTouchEvent<HTMLElement>) => {
    if (startX.current === null || !event.touches.length) return
    if (Math.abs(event.touches[0].clientX - startX.current) > threshold) {
      moved.current = true
    }
  }, [threshold])

  const onTouchEnd = useCallback(() => {
    // Keep the moved flag through the browser's follow-up click event. A
    // timeout is only a fallback for browsers that do not emit that click.
    if (moved.current) deferReset()
    else reset()
  }, [deferReset, reset])

  const onTouchCancel = useCallback(() => {
    reset()
  }, [reset])

  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!moved.current) return
    event.preventDefault()
    event.stopPropagation()
    reset()
  }, [reset])

  useEffect(() => () => reset(), [reset])

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, onClickCapture }
}
