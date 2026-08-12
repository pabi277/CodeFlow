import type { DiffLine } from '../types'

// Line-based LCS diff producing unified-diff-style lines for the mobile viewer.

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n')
}

export function computeUnifiedDiff(oldText: string, newText: string): DiffLine[] {
  const a = splitLines(oldText)
  const b = splitLines(newText)
  const n = a.length
  const m = b.length

  // LCS DP table (bottom-up, full table for correctness)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  // Walk DP to produce the edit sequence
  const ops: ('keep' | 'del' | 'add')[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push('keep')
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push('del')
      i++
    } else {
      ops.push('add')
      j++
    }
  }
  while (i < n) { ops.push('del'); i++ }
  while (j < m) { ops.push('add'); j++ }

  // Map ops back to old/new line indexes
  const oldIdx: number[] = []
  const newIdx: number[] = []
  {
    let oi = 0
    let ni = 0
    for (const op of ops) {
      if (op === 'keep') { oldIdx.push(oi); newIdx.push(ni); oi++; ni++ }
      else if (op === 'del') { oldIdx.push(oi); newIdx.push(-1); oi++ }
      else { oldIdx.push(-1); newIdx.push(ni); ni++ }
    }
  }

  // Emit with context-window trimming around changes
  const lines: DiffLine[] = []
  const runHasChange: boolean[] = ops.map((o) => o !== 'keep')
  let idx = 0
  while (idx < ops.length) {
    if (ops[idx] === 'keep') {
      // find the whole keep-run
      let start = idx
      while (idx < ops.length && ops[idx] === 'keep') idx++
      const end = idx - 1
      // is this run adjacent to any change?
      const nearChange =
        (start > 0 && runHasChange[start - 1]) || (end < ops.length - 1 && runHasChange[end + 1])
      if (nearChange) {
        // emit the whole run (runs bounded by changes are usually small)
        for (let c = start; c <= end; c++) {
          lines.push({ type: 'ctx', oldNo: oldIdx[c] + 1, newNo: newIdx[c] + 1, text: a[oldIdx[c]] })
        }
      } else {
        lines.push({ type: 'ctx', oldNo: -1, newNo: -1, text: `⋯ ${end - start + 1} unchanged lines` })
      }
    } else if (ops[idx] === 'del') {
      lines.push({ type: 'del', oldNo: oldIdx[idx] + 1, newNo: null, text: a[oldIdx[idx]] })
      idx++
    } else {
      lines.push({ type: 'add', oldNo: null, newNo: newIdx[idx] + 1, text: b[newIdx[idx]] })
      idx++
    }
  }

  return lines
}
