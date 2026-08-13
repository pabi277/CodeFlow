// GitHub REST API v3 — all operations grouped by resource.
// PHASE 2: This module is fully implemented in the GitHub integration phase.
// The structure is defined here so the store and UI can reference it.

import axios from 'axios'
import { API } from '../config/api'
import {
  base64ToBytes,
  base64ToText,
  bytesToBase64,
  dataUrlBase64,
  isBinaryPath,
  isImagePath,
  textToBase64,
} from '../utils/encoding'
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

export async function getFileContent(token: string, url: string, path = ''): Promise<string> {
  setToken(token)
  const { data } = await client.get<{ content?: string; content64?: string }>(url)
  if (typeof data === 'string') return data
  if (data.content) return decodeBase64(data.content, path)
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

/**
 * Decode GitHub's base64 response. Text files are UTF-8 decoded so emoji and
 * other non-ASCII characters round-trip correctly; binary files are kept as
 * raw latin1 bytes, matching how binary content is stored locally.
 */
function decodeBase64(s: string, path = ''): string {
  try {
    return isBinaryPath(path) || isImagePath(path) ? base64ToBytes(s) : base64ToText(s)
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

export async function createBlob(token: string, owner: string, repo: string, content: string, path = ''): Promise<string> {
  setToken(token)
  // Binary content is stored locally either as a data URL or as raw latin1
  // bytes (cloned from GitHub). Encode it byte-for-byte instead of
  // round-tripping it through UTF-8.
  const dataUrl = dataUrlBase64(content)
  const encoded = dataUrl
    ? dataUrl.data
    : isBinaryPath(path) || isImagePath(path)
      ? bytesToBase64(content)
      : textToBase64(content)
  const { data } = await client.post<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
    content: encoded,
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
