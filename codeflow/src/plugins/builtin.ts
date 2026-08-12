// Register the built-in CodeFlow plugins. Called once at startup.
import { registerPlugin } from './registry'
import { useStore } from '../store/useStore'

export function initBuiltinPlugins() {
  // Execution History browser
  registerPlugin({
    id: 'execution-history',
    name: 'Execution History',
    description: 'Browse and re-run past code executions.',
    commands: [
      { label: 'Open', run: () => useStore.getState().setHistoryBrowser(true) },
    ],
  })

  // Snippet library
  registerPlugin({
    id: 'snippet-library',
    name: 'Snippet Library',
    description: 'Save and insert reusable code snippets.',
    commands: [
      { label: 'Open', run: () => useStore.getState().setSnippetsOpen(true) },
    ],
  })

  // Git history (read-only)
  registerPlugin({
    id: 'git-log',
    name: 'Git History',
    description: 'View the commit history of the connected repository.',
    commands: [
      { label: 'Open', run: () => useStore.getState().openGitLog() },
    ],
  })

  // Pull requests (read-only)
  registerPlugin({
    id: 'pull-requests',
    name: 'Pull Requests',
    description: 'View open pull requests of the connected repository.',
    commands: [
      { label: 'Open', run: () => useStore.getState().openPrs() },
    ],
  })
}
