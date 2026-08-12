/** Mutable project file list for import-path completions. Set from the editor. */
export interface IndexedFile {
  path: string
  name: string
}

let currentPath = ''
let files: IndexedFile[] = []

export function setProjectIndex(activePath: string, list: IndexedFile[]) {
  currentPath = activePath
  files = list
}

export function getProjectIndex(): { currentPath: string; files: IndexedFile[] } {
  return { currentPath, files }
}
