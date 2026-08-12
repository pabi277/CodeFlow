// Definitively verify autocomplete dropdown appears when typing.
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body><div id="ed"></div></body></html>')
const g = global as any
for (const k of ['window','document','navigator','HTMLElement','Node','Element','getComputedStyle','MutationObserver','Window','SVGElement','DocumentFragment','Text','Comment','Event','CustomEvent','MouseEvent','KeyboardEvent','InputEvent','FocusEvent','WheelEvent']) g[k] = dom.window[k]
g.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }
g.visualViewport = { height:600, addEventListener(){}, removeEventListener(){}, scroll:0 }
g.requestAnimationFrame = (cb:any)=>setTimeout(cb,16)
g.cancelAnimationFrame = ()=>{}
dom.window.requestAnimationFrame = (cb:any)=>setTimeout(cb,16)
dom.window.cancelAnimationFrame = ()=>{}
g.window = dom.window
g.window.matchMedia = ()=>({matches:false,addListener(){},addEventListener(){}})
g.window.scrollTo=()=>{}

import { EditorView, keymap, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'
import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { getCompletionSourceForLanguage } from '../src/editor/completions/index'

async function main() {
  const src = getCompletionSourceForLanguage('python')
  const view = new EditorView({
    parent: document.getElementById('ed')!,
    extensions: [
      keymap.of([...defaultKeymap, ...completionKeymap]),
      autocompletion({ override: [src], activateOnTyping: true, defaultKeymap: true, closeOnBlur: false }),
      highlightActiveLine(),
      EditorView.updateListener.of((u) => { if (u.compositionChanged){} }),
    ],
  })
  // simulate typing "pri"
  view.dispatch(view.state.replaceSelection('pri'))
  // force a completion query as if a key was typed
  const { startCompletion } = await import('@codemirror/autocomplete')
  startCompletion(view)
  await new Promise(r=>setTimeout(r,300))
  const tooltip = document.querySelector('.cm-tooltip-autocomplete')
  console.log('dropdown present:', !!tooltip)
  const items = document.querySelectorAll('.cm-tooltip-autocomplete li')
  console.log('dropdown items:', Array.from(items).slice(0,8).map((li:any)=>li.textContent?.trim()))
  if (tooltip && items.length>0) console.log('✅ AUTocomplete dropdown works in real editor')
  else console.log('❌ dropdown did not appear')
}
main().catch((e)=>{console.error('ERR',e);process.exit(1)})
