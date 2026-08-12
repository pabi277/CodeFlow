// GitHub REST API v3 — all operations grouped by resource.
// PHASE 2: This module is fully implemented in the GitHub integration phase.
// The structure is defined here so the store and UI can reference it.

import axios from 'axios'
import { API } from '../config/api'
import type { GitHubRepo, GitHubTreeResponse, GitHubUser, GitHubBranch, GitHubCommit, GitHubPullRequest } from '../types'

const client = axios.create({ baseURL: API.githubApiBase, timeout: 30000 })

function setToken(token: string) {
  client.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export async function getCurrentUser(token: string): Promise<GitHubUser> {
  setToken(token)
  const { data } = await client.get<GitHubUser>('/user')
  return data
}

export async function listRepos(token: string, query = ''): Promise<GitHubRepo[]> {
  setToken(token)
  const { data } = await client.get<GitHubRepo[]>('/user/repos', {
    params: { per_page: 100, sort: 'updated', visibility: 'all' },
  })
  const q = query.trim().toLowerCase()
  return q ? data.filter((r) => r.full_name.toLowerCase().includes(q)) : data
}

export async function getTree(token: string, owner: string, repo: string, branch: string): Promise<GitHubTreeResponse> {
  setToken(token)
  const { data } = await client.get<GitHubTreeResponse>(`/repos/${owner}/${repo}/git/trees/${branch}`, {
    params: { recursive: '1' },
  })
  return data
}

export async function getFileContent(token: string, url: string): Promise<string> {
  setToken(token)
  const { data } = await client.get<{ content?: string; content64?: string }>(url)
  if (typeof data === 'string') return data
  if (data.content) return decodeBase64(data.content)
  return JSON.stringify(data)
}

export async function checkRateLimit(token: string) {
  setToken(token)
  const { data } = await client.get<{ resources: { core: { remaining: number; reset: number; limit: number } } }>('/rate_limit')
  return data.resources.core
}

export async function getRateLimit(token: string): Promise<{ remaining: number; reset: number; limit: number } | null> {
  try {
    return await checkRateLimit(token)
  } catch {
    return null
  }
}

function decodeBase64(s: string): string {
  try {
    const binary = atob(s.replace(/\s/g, ''))
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return s
  }
}

export async function listBranches(token: string, owner: string, repo: string): Promise<GitHubBranch[]> {
  setToken(token)
  const { data } = await client.get<{ name: string }[]>(`/repos/${owner}/${repo}/branches`, {
    params: { per_page: 100 },
  })
  return data.map((b) => ({ name: b.name }))
}

export async function listCommits(token: string, owner: string, repo: string, branch: string, count = 30): Promise<GitHubCommit[]> {
  setToken(token)
  const { data } = await client.get<GitHubCommit[]>(`/repos/${owner}/${repo}/commits`, {
    params: { sha: branch, per_page: count },
  })
  return data
}

export async function listPullRequests(token: string, owner: string, repo: string, state = 'open'): Promise<GitHubPullRequest[]> {
  setToken(token)
  const { data } = await client.get<GitHubPullRequest[]>(`/repos/${owner}/${repo}/pulls`, {
    params: { state, per_page: 30 },
  })
  return data
}

export async function createBlob(token: string, owner: string, repo: string, content: string): Promise<string> {
  setToken(token)
  const { data } = await client.post<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
    content: btoa(unescape(encodeURIComponent(content))),
    encoding: 'base64',
  })
  return data.sha
}

export async function getRef(token: string, owner: string, repo: string, branch: string): Promise<{ object: { sha: string } }> {
  setToken(token)
  const { data } = await client.get(`/repos/${owner}/${repo}/git/ref/heads/${branch}`)
  return data
}

export async function getCommit(token: string, owner: string, repo: string, sha: string): Promise<{ tree: { sha: string }; message: string }> {
  setToken(token)
  const { data } = await client.get(`/repos/${owner}/${repo}/git/commits/${sha}`)
  return data
}

export async function createTree(
  token: string,
  owner: string,
  repo: string,
  baseTree: string,
  tree: { path: string; mode: string; type: string; sha: string | null }[],
): Promise<string> {
  setToken(token)
  const { data } = await client.post<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, { base_tree: baseTree, tree })
  return data.sha
}

export async function createCommit(
  token: string,
  owner: string,
  repo: string,
  message: string,
  treeSha: string,
  parents: string[],
): Promise<{ sha: string }> {
  setToken(token)
  const { data } = await client.post<{ sha: string }>(`/repos/${owner}/${repo}/git/commits`, { message, tree: treeSha, parents })
  return data
}

export async function updateRef(token: string, owner: string, repo: string, branch: string, sha: string): Promise<void> {
  setToken(token)
  await client.patch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, { sha, force: false })
}

export async function createRef(token: string, owner: string, repo: string, branch: string, sha: string): Promise<void> {
  setToken(token)
  await client.post(`/repos/${owner}/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha })
}

export async function deleteRef(token: string, owner: string, repo: string, branch: string): Promise<void> {
  setToken(token)
  await client.delete(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`)
}
