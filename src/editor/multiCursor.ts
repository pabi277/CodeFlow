import { keymap, EditorView, rectangularSelection, crosshairCursor } from '@codemirror/view'
import { addCursorAbove, addCursorBelow, selectParentSyntax } from '@codemirror/commands'
import { selectNextOccurrence, selectSelectionMatches, highlightSelectionMatches } from '@codemirror/search'
import type { Extension } from '@codemirror/state'

export const multiCursorExtensions: Extension = [
  EditorView.clickAddsSelectionRange.of((e) => e.altKey && !e.shiftKey),
  rectangularSelection({ eventFilter: (e) => e.altKey && e.shiftKey }),
  crosshairCursor(),
  highlightSelectionMatches({ highlightWordAroundCursor: true, minSelectionLength: 2 }),
  keymap.of([
    { key: 'Mod-d', run: selectNextOccurrence },
    { key: 'Shift-Mod-l', run: selectSelectionMatches },
    { key: 'Mod-Alt-ArrowDown', run: addCursorBelow },
    { key: 'Mod-Alt-ArrowUp', run: addCursorAbove },
    { key: 'Mod-i', run: selectParentSyntax },
    { key: 'Shift-Mod-ArrowRight', run: selectParentSyntax },
  ]),
]
