import { db } from './db'
import type { EditorPersistState } from '../types'

const KEY = 'editor_state'

export const EMPTY_EDITOR_STATE: EditorPersistState = {
  openTabIds: [],
  activeTabId: null,
  pinnedTabIds: [],
  cursorPositions: {},
  scrollPositions: {},
  terminalOpen: false,
  terminalHeight: 40,
}

export async function loadEditorState(): Promise<EditorPersistState> {
  const row = await db.editorState.get(KEY)
  return { ...EMPTY_EDITOR_STATE, ...(row?.value as Partial<EditorPersistState>) }
}

export async function saveEditorState(state: EditorPersistState): Promise<void> {
  await db.editorState.put({ key: KEY, value: state })
}
