/* DOM smoke test: renders the Home screen + all always-mounted overlay
 * components to catch any mount-time crash that would cause a blank screen.
 * Run with: npx tsx scripts/smoke.test.tsx
 */
import 'fake-indexeddb/auto'
import { JSDOM } from 'jsdom'
import React from 'react'
import { render, cleanup } from '@testing-library/react'
// tsx uses the classic JSX transform (React.createElement), so expose React
// globally. (Vite uses the automatic runtime — this is harness-only.)
;(global as any).React = React
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
const g = global as any
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Element', 'SVGElement', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'sessionStorage']) {
  g[k] = dom.window[k]
}
g.customElements = dom.window.customElements
g.navigator = { ...dom.window.navigator, onLine: true }
// CodeMirror needs a few things
g.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }
g.visualViewport = { height: 600, addEventListener(){}, removeEventListener(){}, scroll: 0 }
if (!g.window.matchMedia) {
  g.window.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} })
}
g.window.scrollTo = () => {}

import { useStore } from '../src/store/useStore'
import { Home } from '../src/components/Home'
import App from '../src/App'
import { Drawer } from '../src/components/Drawer'
import { CommandPalette } from '../src/components/CommandPalette'
import { FindInProject } from '../src/components/FindInProject'
import { Settings } from '../src/components/Settings'
import { ContextMenu } from '../src/components/Shared/ContextMenu'
import { ImportProjectModal } from '../src/components/Shared/ImportProjectModal'
import { Toasts } from '../src/components/Shared/Toasts'
import { ExecutionHistory } from '../src/components/ExecutionHistory'
import { SnippetLibrary } from '../src/components/SnippetLibrary'
import { GitLog } from '../src/components/GitHub/GitLog'
import { PullRequests } from '../src/components/GitHub/PullRequests'
import { PluginHost } from '../src/components/PluginHost'
import { RepoBrowser } from '../src/components/GitHub/RepoBrowser'
import { CommitModal } from '../src/components/GitHub/CommitModal'
import { BranchPicker } from '../src/components/GitHub/BranchPicker'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

const COMPONENTS: [string, React.ComponentType][] = [
  ['Home', Home],
  ['Drawer', Drawer],
  ['CommandPalette', CommandPalette],
  ['FindInProject', FindInProject],
  ['Settings', Settings],
  ['ContextMenu', ContextMenu],
  ['ImportProjectModal', ImportProjectModal],
  ['Toasts', Toasts],
  ['ExecutionHistory', ExecutionHistory],
  ['SnippetLibrary', SnippetLibrary],
  ['GitLog', GitLog],
  ['PullRequests', PullRequests],
  ['PluginHost', PluginHost],
  ['RepoBrowser', RepoBrowser],
  ['CommitModal', CommitModal],
  ['BranchPicker', BranchPicker],
]

async function main() {
  // initialize the store so selectors have state
  await useStore.getState().bootstrap().catch(() => {})
  console.log('store booted, activeProjectId =', useStore.getState().activeProjectId)

  for (const [name, Comp] of COMPONENTS) {
    cleanup()
    try {
      render(<Comp />)
      ok(true, `${name} rendered without crashing`)
    } catch (err: any) {
      ok(false, `${name} THREW: ${err?.message || err}\n    ${(err?.stack || '').split('\n').slice(0, 4).join('\n    ')}`)
    }
  }

  console.log('\n[App — booted false → true transition (catches React #310)]')
  // Reset booted to false, render App, then set booted=true and re-render.
  // Any hook count that differs between these two renders will throw #310.
  useStore.setState({ booted: false })
  cleanup()
  try {
    render(<App />)
    // bootstrap() flips booted to true and re-renders the tree
    await useStore.getState().bootstrap().catch(() => {})
    ok(true, 'App rendered through booted=false → true without React #310')
  } catch (err: any) {
    ok(false, `App THREW: ${err?.message || err}\n    ${(err?.stack || '').split('\n').slice(0, 4).join('\n    ')}`)
  }
  cleanup()

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
