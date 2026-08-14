// GitHub REST API v3 — all operations grouped by resource.

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
} from '../utils/binary'
import type { GitHubRepo, GitHubTreeResponse, GitHubUser, GitHubBranch, GitHubCommit, GitHubPullRequest } from '../types'

const client = axios.create({ baseURL: API.githubApiBase, timeout: 30000 })

function setToken(token: string) {
  client.defaults.headers.common['Authorization'] = `Bearer ${token}`
  client.defaults.headers.common['Accept'] = 'application/vnd.github+json'
}

export async function getCurrentUser(token: string): Promise<GitHubUser> {
  setToken(token)
  const { data } = await client.get<GitHubUser>('/user')
  return data
}

export async function listRepos(token: string, query = ''): Promise<GitHubRepo[]> {
  setToken(token)
  const all: GitHubRepo[] = []
  for (let page = 1; page <= 5; page++) {
    const { data } = await client.get<GitHubRepo[]>('/user/repos', {
      params: { per_page: 100, page, sort: 'updated', visibility: 'all' },
    })
    all.push(...data)
    if (data.length < 100) break
  }
  const q = query.trim().toLowerCase()
  return q ? all.filter((r) => r.full_name.toLowerCase().includes(q)) : all
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
 * other non-ASCII characters round-trip correctly; binary files (images,
 * fonts, archives, …) are kept as raw latin1 bytes, matching how binary
 * content is stored locally.
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

/** Encode a repo-relative file path for the contents API (slashes keep meaning). */
function encodeContentsPath(path: string): string {
  return path.split('/').map((seg) => encodeURIComponent(seg)).join('/')
}

/**
 * Encode file content as base64 exactly the way GitHub expects it back:
 * text files as UTF-8 (emoji and other non-ASCII survive), binary files and
 * stored data URLs byte-for-byte.
 */
function encodeContent(content: string, path = ''): string {
  const binaryPath = isBinaryPath(path) || isImagePath(path)
  const dataUrl = binaryPath ? dataUrlBase64(content) : null
  if (dataUrl) return dataUrl.data
  if (binaryPath) return bytesToBase64(content)
  return textToBase64(content)
}

export async function createBlob(token: string, owner: string, repo: string, content: string, path = ''): Promise<string> {
  setToken(token)
  const { data } = await client.post<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
    content: encodeContent(content, path),
    encoding: 'base64',
  })
  return data.sha
}

/**
 * Create a single file through the contents API. This is the ONLY way to put
 * the very first commit into a brand-new (empty) repository: the git database
 * endpoints (blobs / trees / commits / refs) all respond 409 "Git Repository
 * is empty" until the repository has been initialized by a first commit.
 */
export async function createOrUpdateFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch?: string,
): Promise<{ commitSha: string; blobSha: string }> {
  setToken(token)
  const { data } = await client.put<{ content: { sha: string }; commit: { sha: string } }>(
    `/repos/${owner}/${repo}/contents/${encodeContentsPath(path)}`,
    {
      message,
      content: encodeContent(content, path),
      ...(branch ? { branch } : {}),
    },
  )
  return { commitSha: data.commit.sha, blobSha: data.content.sha }
}

/** Create a brand-new repository under the authenticated user. */
export async function createRepo(
  token: string,
  opts: { name: string; description?: string; private?: boolean },
): Promise<GitHubRepo> {
  setToken(token)
  const { data } = await client.post<GitHubRepo>('/user/repos', {
    name: opts.name,
    description: opts.description || '',
    private: opts.private ?? false,
    auto_init: false,
    has_issues: true,
    has_wiki: true,
  })
  return data
}

/** Fetch a single repository (to learn its default branch / emptiness). */
export async function getRepo(token: string, owner: string, repo: string): Promise<GitHubRepo> {
  setToken(token)
  const { data } = await client.get<GitHubRepo>(`/repos/${owner}/${repo}`)
  return data
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
  baseTree: string | null,
  tree: { path: string; mode: string; type: string; sha: string | null }[],
): Promise<string> {
  setToken(token)
  // base_tree must be omitted for the first commit in a brand-new (empty) repository.
  const body: Record<string, unknown> = { tree }
  if (baseTree) body.base_tree = baseTree
  const { data } = await client.post<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, body)
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
