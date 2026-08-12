import { useRef } from 'react'
import { useStore } from '../../store/useStore'
import { BottomSheet } from './BottomSheet'
import { AiOutlineDownload, AiOutlineFolder, AiOutlineFile, AiOutlineCloudUpload } from 'react-icons/ai'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Modal to import an existing project into CodeFlow — either from a .zip,
 * a folder, or a set of files. Each creates a brand-new project.
 */
export function ImportProjectModal({ open, onClose }: Props) {
  const zipRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const importFromZip = useStore((s) => s.importProjectFromZip)
  const importFromFiles = useStore((s) => s.importProjectFromFiles)

  const onZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { await importFromZip(f); onClose() }
    e.target.value = ''
  }
  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) { await importFromFiles(e.target.files); onClose() }
    e.target.value = ''
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Import project">
      <div className="space-y-2 p-4 pb-6">
        <input ref={zipRef} type="file" accept=".zip" className="hidden" onChange={onZip} />
        {/* webkitdirectory lets Android pickers select a whole folder */}
        <input ref={folderRef} type="file" className="hidden" {...({ webkitdirectory: '' } as any)} onChange={onFiles} />
        <input ref={filesRef} type="file" multiple className="hidden" onChange={onFiles} />

        <button
          onClick={() => zipRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl bg-white/5 px-4 py-4 text-left active:bg-white/10"
        >
          <AiOutlineDownload className="text-2xl text-accent" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium text-ink">Import from ZIP</div>
            <div className="text-[12px] text-ink-muted">Upload a .zip — its contents become a new project</div>
          </div>
        </button>

        <button
          onClick={() => folderRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl bg-white/5 px-4 py-4 text-left active:bg-white/10"
        >
          <AiOutlineFolder className="text-2xl text-accent" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium text-ink">Import a folder</div>
            <div className="text-[12px] text-ink-muted">Pick an entire folder (opens the app like VS Code opens a workspace)</div>
          </div>
        </button>

        <button
          onClick={() => filesRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl bg-white/5 px-4 py-4 text-left active:bg-white/10"
        >
          <AiOutlineFile className="text-2xl text-accent" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium text-ink">Import files</div>
            <div className="text-[12px] text-ink-muted">Select one or more files to create a project</div>
          </div>
        </button>

        <p className="flex items-center gap-1.5 pt-1 text-[11px] text-ink-muted">
          <AiOutlineCloudUpload className="text-ink-muted" />
          On Android, choose "Files" in the picker to navigate to a folder.
        </p>
      </div>
    </BottomSheet>
  )
}
