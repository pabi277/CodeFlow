export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let t: ReturnType<typeof setTimeout> | null = null
  return (...args: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}

export function throttle<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let last = 0
  let t: ReturnType<typeof setTimeout> | null = null
  return (...args: A) => {
    const now = Date.now()
    const remaining = wait - (now - last)
    if (remaining <= 0) {
      if (t) clearTimeout(t)
      last = now
      fn(...args)
    } else if (!t) {
      t = setTimeout(() => {
        last = Date.now()
        t = null
        fn(...args)
      }, remaining)
    }
  }
}
