import { keymap, EditorView } from '@codemirror/view'
import { addCursorAbove, addCursorBelow } from '@codemirror/commands'
import { selectNextOccurrence, selectSelectionMatches } from '@codemirror/search'
import type { Extension } from '@codemirror/state'

export const multiCursorExtensions: Extension = [
  EditorView.clickAddsSelectionRange.of((e) => e.altKey),
  keymap.of([
    { key: 'Mod-d', run: selectNextOccurrence },
    { key: 'Shift-Mod-l', run: selectSelectionMatches },
    { key: 'Mod-Alt-ArrowDown', run: addCursorBelow },
    { key: 'Mod-Alt-ArrowUp', run: addCursorAbove },
  ]),
]
