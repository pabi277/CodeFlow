/* DOM test: FileExplorer rows show a ⋮ button that opens the context menu
 * with Download / Share / Duplicate / Change Path / Rename / Delete actions.
 * Run with: npx tsx scripts/explorerContextMenu.test.tsx
 */
import 'fake-indexeddb/auto'
import { JSDOM } from 'jsdom'
import React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
;(global as any).React = React
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
const g = global as any
for (const k of ['window', 'document', 'HTMLElement', 'Node', 'Element', 'SVGElement', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'sessionStorage']) {
  g[k] = dom.window[k]
}
g.customElements = dom.window.customElements
try { g.navigator = { ...dom.window.navigator, onLine: true, vibrate: () => {} } } catch { Object.defineProperty(g, 'navigator', { configurable: true, value: { ...dom.window.navigator, onLine: true, vibrate: () => {} } }) }
g.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }
g.visualViewport = { height: 600, addEventListener(){}, removeEventListener(){}, scroll: 0 }
g.window.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} })
g.window.scrollTo = () => {}

import { useStore } from '../src/store/useStore'
import { FileExplorer } from '../src/components/FileExplorer/FileExplorer'
import { ContextMenu } from '../src/components/Shared/ContextMenu'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log(`  ✅ ${m}`) } else { fail++; console.error(`  ❌ ${m}`) } }

async function main() {
  // seed a project + file nodes in the store
  useStore.setState({
    activeProjectId: 'proj1',
    projects: [{ id: 'proj1', name: 'proj1', rootFolderId: 'root', createdAt: 0, lastOpenedAt: 0, github: { owner: null, repo: null, branch: null, lastSyncAt: null, connected: false } }] as any,
    nodeMap: {
      root: { id: 'root', name: 'proj1', type: 'folder', path: '/', parentId: null, childIds: ['f1'], content: '', createdAt: 0, modifiedAt: 0, isGitModified: false, gitSha: null, originalContent: '', isNew: false, isDeleted: false, projectId: 'proj1' } as any,
      f1: { id: 'f1', name: 'main.py', type: 'file', path: '/main.py', parentId: 'root', childIds: [], content: 'print(1)', createdAt: 0, modifiedAt: 0, isGitModified: false, gitSha: null, originalContent: 'print(1)', isNew: true, isDeleted: false, projectId: 'proj1' } as any,
    },
    expanded: { root: true },
  })

  render(<><FileExplorer /><ContextMenu /></>)

  // ⋮ button exists for the file row
  const moreBtn = document.querySelector('button[aria-label="Options for main.py"]')
  ok(!!moreBtn, 'file row shows a ⋮ (Options) button')

  // clicking it opens the context menu (store state + sheet title)
  fireEvent.click(moreBtn!)
  ok(useStore.getState().contextMenu?.nodeId === 'f1', 'clicking ⋮ sets contextMenu nodeId')
  const sheetTitle = [...document.querySelectorAll('h2')].map((h) => h.textContent)
  ok(sheetTitle.includes('main.py'), 'context menu sheet opens with the file name')

  // menu contains Download / Share / Duplicate / Change Path / Rename / Delete
  const labels = [...document.querySelectorAll('button')].map((b) => b.textContent || '')
  ok(labels.some((l) => l.includes('Download')), 'menu has Download')
  ok(labels.some((l) => l.includes('Share')), 'menu has Share')
  ok(labels.some((l) => l.includes('Duplicate')), 'menu has Duplicate')
  ok(labels.some((l) => l.includes('Change Path')), 'menu has Change Path / Move')
  ok(labels.some((l) => l.includes('Rename')), 'menu has Rename')
  ok(labels.some((l) => l.includes('Delete')), 'menu has Delete')

  cleanup()
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
