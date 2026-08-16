import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { MdExpandMore } from 'react-icons/md'
import { AiOutlineCloudUpload, AiOutlinePlus, AiOutlineSearch } from 'react-icons/ai'
import { FiMoreVertical } from 'react-icons/fi'
import type { FileNode } from '../../types'
import { FileIcon } from '../Shared/FileIcon'
import { BottomSheet } from '../Shared/BottomSheet'

function nameColor(node: FileNode): string {
  if (node.isDeleted) return 'text-red-400 line-through'
  if (node.isNew) return 'text-emerald-400'
  if (node.isGitModified) return 'text-yellow-400'
  return 'text-ink'
}

export function FileExplorer() {
  const nodeMap = useStore((s) => s.nodeMap)
  const expanded = useStore((s) => s.expanded)
  const toggleFolder = useStore((s) => s.toggleFolder)
  const openFile = useStore((s) => s.openFile)
  const setNewItemModal = useStore((s) => s.setNewItemModal)
  const openContextMenu = useStore((s) => s.openContextMenu)
  const moveNode = useStore((s) => s.moveNode)
  const uploadFilesToFolder = useStore((s) => s.uploadFilesToFolder)
  const [query, setQuery] = useState('')

  const rootIds = useMemo(() => {
    const root = Object.values(nodeMap).find((n) => n.path === '/')
    return root ? [root.id] : []
  }, [nodeMap])

  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return Object.values(nodeMap)
      .filter((n) => n.type === 'file' && n.path.toLowerCase().includes(q))
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, 100)
  }, [query, nodeMap])

  const openMenu = (nodeId: string, clientX: number, clientY: number) => {
    try { navigator.vibrate?.(12) } catch {}
    openContextMenu({ nodeId, x: clientX, y: clientY, clientX, clientY })
  }

  const MoreBtn = ({ nodeId, label }: { nodeId: string; label: string }) => (
    <button
      onClick={(e) => { e.stopPropagation(); openMenu(nodeId, e.clientX, e.clientY) }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openMenu(nodeId, e.clientX, e.clientY) }}
      onDragStart={(e) => e.stopPropagation()}
      aria-label={`Options for ${label}`}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted/70 active:bg-white/10"
    >
      <FiMoreVertical size={15} />
    </button>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-3 pb-2">
        <div className="relative flex flex-1 items-center">
          <AiOutlineSearch className="pointer-events-none absolute left-3 text-ink-muted/70" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            className="h-10 w-full rounded-lg border border-border/60 bg-input pl-9 pr-3 text-[14px] text-ink outline-none transition-shadow focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_25%,transparent)] placeholder:text-ink-muted/60"
          />
        </div>
        <button
          onClick={() => setNewItemModal({ parentId: null, type: 'file' })}
          aria-label="New file"
          className="btn-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white"
        >
          <AiOutlinePlus size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {query.trim() ? (
          searchResults.length ? (
            searchResults.map((n) => (
              <div key={n.id} className="flex items-center gap-2 px-4 py-1.5 active:bg-white/5" onClick={() => openFile(n.id)}>
                <FileIcon name={n.name} type="file" size={16} className="text-ink-muted" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{n.path}</span>
                <MoreBtn nodeId={n.id} label={n.name} />
              </div>
            ))
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-ink-muted">No matching files</p>
          )
        ) : rootIds.length ? (
          rootIds.map((id) => <TreeNode key={id} nodeId={id} depth={0} />)
        ) : (
          <p className="px-4 py-6 text-center text-[13px] text-ink-muted">Empty project — tap + to add a file</p>
        )}
      </div>
      <NewItemModal />
    </div>
  )

  function TreeNode({ nodeId, depth }: { nodeId: string; depth: number }) {
    const node = nodeMap[nodeId]
    if (!node) return null
    const isFolder = node.type === 'folder'
    const isOpen = !!expanded[nodeId]
    return (
      <div>
        <div
          className="mx-1 flex items-center gap-1 rounded py-1.5 pr-1.5 active:bg-accent/10"
          style={{ paddingLeft: depth * 18 + 6 }}
          draggable
          onDragStart={(e) => { e.dataTransfer.setData('text/node-id', nodeId); e.dataTransfer.effectAllowed = 'move' }}
          onDragOver={(e) => {
            if (isFolder) {
              e.preventDefault()
              e.dataTransfer.dropEffect = e.dataTransfer.files?.length ? 'copy' : 'move'
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!isFolder) return
            if (e.dataTransfer.files?.length) {
              void uploadFilesToFolder(nodeId, e.dataTransfer.files)
              return
            }
            const from = e.dataTransfer.getData('text/node-id')
            if (from && from !== nodeId) void moveNode(from, nodeId)
          }}
          onContextMenu={(e) => { e.preventDefault(); openMenu(nodeId, e.clientX, e.clientY) }}
          onClick={() => (isFolder ? toggleFolder(nodeId) : openFile(nodeId))}
        >
          <span className="w-5 shrink-0 text-ink-muted transition-transform duration-200" style={{ transform: isFolder && isOpen ? 'rotate(0)' : 'rotate(-90deg)' }}>
            {isFolder ? <MdExpandMore size={16} /> : null}
          </span>
          <span className="mr-1.5 shrink-0">
            <FileIcon name={node.name} type={node.type} isOpen={isOpen} size={18} />
          </span>
          <span className={`min-w-0 flex-1 truncate text-[13.5px] ${nameColor(node)}`}>{node.name}</span>
          <MoreBtn nodeId={nodeId} label={node.name} />
        </div>
        {isFolder && isOpen && node.childIds.filter((cid) => !nodeMap[cid]?.isDeleted).map((cid) => <TreeNode key={cid} nodeId={cid} depth={depth + 1} />)}
      </div>
    )
  }
}

function NewItemModal() {
  const modal = useStore((s) => s.newItemModal)
  const setModal = useStore((s) => s.setNewItemModal)
  const createNode = useStore((s) => s.createNode)
  const uploadFilesToFolder = useStore((s) => s.uploadFilesToFolder)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<'file' | 'folder'>('file')
  const [name, setName] = useState('')

  // Every launcher supplies an explicit intended type. Reset the sheet from
  // that value instead of retaining the previous File/Folder toggle selection.
  useEffect(() => {
    if (!modal) return
    setType(modal.type)
    setName('')
  }, [modal])

  const submit = async () => {
    if (!name.trim() || !modal) return
    await createNode(modal.parentId, type, name.trim())
    setName('')
    setModal(null)
  }

  return (
    <BottomSheet open={!!modal} onClose={() => setModal(null)} title="New item">
      <div className="p-4">
        <div className="mb-3 flex gap-2">
          <button onClick={() => setType('file')} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${type === 'file' ? 'bg-accent text-white' : 'bg-input text-ink'}`}>File</button>
          <button onClick={() => setType('folder')} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${type === 'folder' ? 'bg-accent text-white' : 'bg-input text-ink'}`}>Folder</button>
        </div>
        <input
          ref={uploadRef}
          type="file"
          multiple
          className="hidden"
          onChange={async (event) => {
            const files = event.target.files
            if (files?.length && modal) {
              const created = await uploadFilesToFolder(modal.parentId, files)
              if (created) setModal(null)
            }
            event.target.value = ''
          }}
        />
        <button
          onClick={() => uploadRef.current?.click()}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-[13px] font-medium text-accent active:bg-accent/20"
        >
          <AiOutlineCloudUpload size={18} /> Upload existing file{modal?.parentId ? ' into this folder' : ''}
        </button>
        <div className="mb-2 flex items-center gap-3 text-[10px] uppercase tracking-wider text-ink-muted">
          <span className="h-px flex-1 bg-border/60" /> or create a new item <span className="h-px flex-1 bg-border/60" />
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={type === 'file' ? 'e.g. index.js or main.py' : 'folder name'}
          className="w-full rounded-xl border border-ink/15 bg-input px-4 py-3 text-[16px] text-ink outline-none focus:border-accent"
        />
        <div className="mt-4 flex gap-3">
          <button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-ink/15 px-4 py-3 text-ink active:bg-black/5 dark:active:bg-white/5">Cancel</button>
          <button onClick={submit} disabled={!name.trim()} className="flex-1 rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-40">Create</button>
        </div>
      </div>
    </BottomSheet>
  )
}
