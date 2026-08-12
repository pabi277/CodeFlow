import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { BottomSheet } from './BottomSheet'
import { NameModal } from './NameModal'
import { FiCopy, FiEdit3, FiTrash2, FiFilePlus, FiFolderPlus, FiShare2, FiDownload, FiPlayCircle, FiMove, FiRotateCcw } from 'react-icons/fi'
import { AiOutlineFile } from 'react-icons/ai'
import type { FileNode } from '../../types'
import { isDataUrl, mimeForPath } from '../../utils/binary'
import { buildFolderZip, downloadFolderZip } from '../../utils/zip'

export function ContextMenu() {
  const ctx = useStore((s) => s.contextMenu)
  const close = useStore((s) => s.closeContextMenu)
  const nodeMap = useStore((s) => s.nodeMap)
  const openFile = useStore((s) => s.openFile)
  const renameNode = useStore((s) => s.renameNode)
  const deleteNode = useStore((s) => s.deleteNode)
  const duplicateNode = useStore((s) => s.duplicateNode)
  const setNewItemModal = useStore((s) => s.setNewItemModal)
  const showToast = useStore((s) => s.showToast)
  const setMainFile = useStore((s) => s.setMainFile)
  const activeProjectId = useStore((s) => s.activeProjectId)
  const runConfiguration = useStore((s) => s.settings.runConfiguration)

  // The node we are renaming persists even after the context menu closes,
  // so the rename sheet can stay open. We track its id separately.
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const moveNode = useStore((s) => s.moveNode)
  const revertToSaved = useStore((s) => s.revertToSaved)
  const dirtyTabs = useStore((s) => s.dirtyTabs)

  const node = ctx ? nodeMap[ctx.nodeId] : undefined
  const renamingNode = renamingId ? nodeMap[renamingId] : undefined

  const vibrate = () => { try { navigator.vibrate?.(10) } catch {} }

  const handleDelete = () => {
    vibrate()
    if (node) {
      if (node.type === 'file') {
        deleteNode(node.id)
        showToast(`Deleted ${node.name}`, 'success')
      } else if (window.confirm(`Delete folder "${node.name}" and all its contents?`)) {
        deleteNode(node.id)
        showToast(`Deleted ${node.name}`, 'success')
      }
    }
    close()
  }

  const copyPath = () => {
    if (!node) return
    try { navigator.clipboard?.writeText(node.path) } catch {}
    showToast('Path copied', 'success')
    close()
  }

  const share = async () => {
    if (!node) return
    try {
      const blob = await blobForNode(node)
      const attempt = await tryShareFile(node.name, blob, node.content)
      if (attempt === 'shared') {
        showToast(`Shared ${node.name}`, 'success')
        return
      }
      if (attempt === 'cancelled') return

      const copied = await copyText(node.content)
      if (copied) {
        showToast('System sharing is unavailable — file content copied as text', 'info')
      } else {
        await saveBlob(blob, node.name)
        showToast(`Downloaded ${node.name} so you can share it`, 'info')
      }
    } catch (error) {
      showToast((error as Error).message || 'Could not share the file', 'error')
    }
  }

  const shareFolder = async () => {
    if (!node || node.type !== 'folder') return
    try {
      const blob = await buildFolderZip(node.id, nodeMap)
      const zipName = `${node.name}.zip`
      const attempt = await tryShareFile(zipName, blob)
      if (attempt === 'shared') {
        showToast(`Shared ${zipName}`, 'success')
      } else if (attempt !== 'cancelled') {
        await saveBlob(blob, zipName)
        showToast(`Downloaded ${zipName} so you can share it`, 'info')
      }
    } catch (error) {
      showToast((error as Error).message || 'Could not share the folder', 'error')
    }
  }

  const download = async () => {
    if (!node) return
    try {
      const blob = await blobForNode(node)
      await saveBlob(blob, node.name)
      showToast(`Downloaded ${node.name}`, 'success')
    } catch (err) {
      showToast((err as Error).message || 'Could not download the file', 'error')
    }
  }

  const downloadFolder = async () => {
    if (!node || node.type !== 'folder') return
    try {
      await downloadFolderZip(node.id, nodeMap, node.name)
      showToast(`Downloaded ${node.name}.zip`, 'success')
    } catch (error) {
      showToast((error as Error).message || 'Could not download the folder', 'error')
    }
  }

  const Item = ({ icon, label, onPress, danger }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) => (
    <button
      onClick={() => { onPress(); close() }}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] active:bg-black/5 dark:active:bg-white/5 ${
        danger ? 'text-red-500' : 'text-ink'
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </button>
  )

  return (
    <>
      {node && (
        <BottomSheet open onClose={close} title={node.name}>
          <div className="divide-y divide-ink/5 pb-2 dark:divide-white/5">
            {node.type === 'file' && <Item icon={<AiOutlineFile />} label="Open" onPress={() => openFile(node.id)} />}
            {node.type === 'file' && <Item icon={<FiCopy />} label="Duplicate" onPress={() => duplicateNode(node.id)} />}
            {node.type === 'file' && (
              <Item
                icon={<FiPlayCircle />}
                label={activeProjectId && runConfiguration[activeProjectId] === node.id ? 'Main file (running)' : 'Set as main file to run'}
                onPress={() => setMainFile(node.id)}
              />
            )}
            {node.type === 'folder' && <Item icon={<FiFilePlus />} label="New File Inside" onPress={() => setNewItemModal({ parentId: node.id, type: 'file' })} />}
            {node.type === 'folder' && <Item icon={<FiFolderPlus />} label="New Folder Inside" onPress={() => setNewItemModal({ parentId: node.id, type: 'folder' })} />}
            {node.path !== '/' && <Item icon={<FiMove />} label="Move to…" onPress={() => setMovingId(node.id)} />}
            {node.type === 'file' && dirtyTabs[node.id] && (
              <Item icon={<FiRotateCcw />} label="Revert to last save" onPress={() => { void revertToSaved(node.id) }} />
            )}
            <Item icon={<FiEdit3 />} label="Rename" onPress={() => setRenamingId(node.id)} />
            <Item icon={<FiCopy />} label="Copy Path" onPress={copyPath} />
            {node.type === 'file' && <Item icon={<FiShare2 />} label="Share file" onPress={share} />}
            {node.type === 'file' && <Item icon={<FiDownload />} label="Download file" onPress={download} />}
            {node.type === 'folder' && <Item icon={<FiShare2 />} label="Share folder as ZIP" onPress={shareFolder} />}
            {node.type === 'folder' && <Item icon={<FiDownload />} label="Download folder as ZIP" onPress={downloadFolder} />}
            <Item icon={<FiTrash2 />} label={node.type === 'file' ? 'Delete' : 'Delete Folder'} onPress={handleDelete} danger />
          </div>
        </BottomSheet>
      )}

      {/* Rename modal rendered unconditionally so it stays mounted after the menu closes */}
      {renamingNode && (
        <NameModal
          open={!!renamingId}
          title="Rename"
          initial={renamingNode.name}
          placeholder="New name"
          submitLabel="Rename"
          onClose={() => setRenamingId(null)}
          onSubmit={(v) => renameNode(renamingNode.id, v)}
        />
      )}

      {movingId && (
        <MoveSheet
          nodeId={movingId}
          onClose={() => setMovingId(null)}
          onPick={(folderId) => { void moveNode(movingId, folderId); setMovingId(null) }}
        />
      )}
    </>
  )
}

type ShareAttempt = 'shared' | 'cancelled' | 'unsupported'

async function tryShareFile(name: string, blob: Blob, text?: string): Promise<ShareAttempt> {
  if (typeof navigator.share !== 'function') return 'unsupported'

  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' })
  const canTryFile = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })
  if (canTryFile) {
    try {
      await navigator.share({ title: name, files: [file] })
      return 'shared'
    } catch (error) {
      if (isShareCancelled(error)) return 'cancelled'
    }
  }

  if (text !== undefined) {
    try {
      await navigator.share({ title: name, text })
      return 'shared'
    } catch (error) {
      if (isShareCancelled(error)) return 'cancelled'
    }
  }
  return 'unsupported'
}

async function saveBlob(blob: Blob, name: string): Promise<void> {
  const { saveAs } = await import('file-saver')
  saveAs(blob, name)
}

function isShareCancelled(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error && error.name === 'AbortError'
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Try the legacy copy path below.
  }

  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    area.remove()
    return copied
  } catch {
    return false
  }
}

async function blobForNode(node: FileNode): Promise<Blob> {
  if (isDataUrl(node.content)) {
    try {
      return await (await fetch(node.content)).blob()
    } catch {
      // Fall through to a text blob if a data URL cannot be decoded.
    }
  }
  return new Blob([node.content], { type: mimeForPath(node.path) })
}

function MoveSheet({ nodeId, onClose, onPick }: { nodeId: string; onClose: () => void; onPick: (id: string) => void }) {
  const nodeMap = useStore((s) => s.nodeMap)
  const folders = Object.values(nodeMap).filter((n) => n.type === 'folder' && n.id !== nodeId)
  return (
    <BottomSheet open onClose={onClose} title="Move to folder">
      <div className="max-h-[50vh] overflow-y-auto pb-2">
        {folders.map((f) => (
          <button
            key={f.id}
            onClick={() => onPick(f.id)}
            className="flex w-full px-4 py-3 text-left text-[14px] text-ink active:bg-white/5"
          >
            {f.path === '/' ? '/ (project root)' : f.path}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
