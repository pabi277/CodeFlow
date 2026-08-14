import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { MdExpandMore } from 'react-icons/md'
import { AiOutlineSearch, AiOutlinePlus } from 'react-icons/ai'
import type { FileNode } from '../../types'
import { FileIcon } from '../../utils/getFileIcon'
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-3 pb-2">
        <div className="relative flex flex-1 items-center">
          <AiOutlineSearch className="pointer-events-none absolute left-3 text-ink-muted/70" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            className="h-10 w-full rounded-md border border-border/60 bg-input pl-9 pr-3 text-[14px] text-ink outline-none transition-shadow focus:border-accent focus:shadow-[0_0_0_3px_rgba(9,105,218,0.15)] placeholder:text-ink-muted/60"
          />
        </div>
        <button
          onClick={() => setNewItemModal({ parentId: null, type: 'file' })}
          aria-label="New file"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-white active:opacity-80"
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
                <span className="text-[13px] text-ink">{n.path}</span>
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
          className="mx-1 flex items-center gap-1 rounded py-1.5 pr-2 active:bg-accent/10"
          style={{ paddingLeft: depth * 18 + 6 }}
          draggable
          onDragStart={(e) => { e.dataTransfer.setData('text/node-id', nodeId); e.dataTransfer.effectAllowed = 'move' }}
          onDragOver={(e) => {
            if (isFolder) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const from = e.dataTransfer.getData('text/node-id')
            if (from && isFolder && from !== nodeId) void moveNode(from, nodeId)
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
          <span className={`truncate text-[13.5px] ${nameColor(node)}`}>{node.name}</span>
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
  const [type, setType] = useState<'file' | 'folder'>('file')
  const [name, setName] = useState('')

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
