// Test seam / indirection for the GitHub REST client.
// gitService calls through this mutable object so integration tests can
// substitute a fake in-memory GitHub backend without touching the real client.
import * as gh from './githubService'

export const github = { ...gh }
