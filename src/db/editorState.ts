import { db } from './db'
import type { EditorPersistState } from '../types'

const KEY = 'editor_state'

/** Editor chrome (open tabs, active tab, pinned tabs) is per-project so that
 *  restoring one project never points the editor at another project's files. */
function keyFor(projectId: string | null | undefined): string {
  return projectId ? `${KEY}:${projectId}` : KEY
}

export const EMPTY_EDITOR_STATE: EditorPersistState = {
  openTabIds: [],
  activeTabId: null,
  pinnedTabIds: [],
  cursorPositions: {},
  scrollPositions: {},
  terminalOpen: false,
  terminalHeight: 40,
}

export async function loadEditorState(projectId?: string | null): Promise<EditorPersistState> {
  const row = await db.editorState.get(keyFor(projectId))
  return { ...EMPTY_EDITOR_STATE, ...(row?.value as Partial<EditorPersistState>) }
}

export async function saveEditorState(state: EditorPersistState, projectId?: string | null): Promise<void> {
  await db.editorState.put({ key: keyFor(projectId), value: state })
}
