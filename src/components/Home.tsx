import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { relativeTime } from '../utils/format'
import { AiOutlinePlus } from 'react-icons/ai'
import { VscTrash, VscCode, VscFolderOpened } from 'react-icons/vsc'
import { FaFolderOpen } from 'react-icons/fa'
import { NameModal } from './Shared/NameModal'

const SAMPLE = [
  { path: 'main.py', content: '# Hello, CodeFlow!\ndef main():\n    name = input("Enter your name: ")\n    print(f"Hello, {name}!")\n\nif __name__ == "__main__":\n    main()\n' },
  { path: 'hello.js', content: '// JavaScript runs locally without an API key\nconst name = "CodeFlow";\nconsole.log("Hello, " + name + "!");\nfor (let i = 1; i <= 3; i++) console.log("Count: " + i);\n' },
  { path: 'readme.md', content: '# My Project\n\nWelcome to **CodeFlow** — a mobile-first code editor PWA.\n\n- Tap a file in the explorer to open it\n- Tap ▶ to run the active file\n- Long-press a file for more options\n- Open this file and tap the eye icon for a live preview\n\n```python\nprint("You can preview fenced code too")\n```\n\n| Shortcut | Action |\n| --- | --- |\n| Ctrl/Cmd+P | Command palette |\n| Ctrl/Cmd+G | Go to line |\n' },
  { path: 'preview.html', content: '<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8"/>\n  <title>CodeFlow Preview</title>\n  <style>\n    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: grid; place-items: center; min-height: 100vh; margin: 0; }\n    .card { background: #1e293b; padding: 28px 32px; border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,.35); text-align: center; }\n    h1 { margin: 0 0 8px; font-size: 1.6rem; }\n    p { margin: 0; color: #94a3b8; }\n    button { margin-top: 16px; background: #38bdf8; border: 0; color: #0f172a; font-weight: 700; padding: 8px 14px; border-radius: 8px; }\n  </style>\n</head>\n<body>\n  <div class="card">\n    <h1>Hello from CodeFlow</h1>\n    <p>This HTML file previews live in the editor.</p>\n    <button onclick="this.textContent = \'It works!\'">Tap me</button>\n  </div>\n</body>\n</html>\n' },
]

export function Home() {
  const projects = useStore((s) => s.projects)
  const setActiveProject = useStore((s) => s.setActiveProject)
  const newProject = useStore((s) => s.newProject)
  const deleteProject = useStore((s) => s.deleteProject)
  const showToast = useStore((s) => s.showToast)
  const [creating, setCreating] = useState(false)
  const [creatingEmpty, setCreatingEmpty] = useState(false)
  const homeAction = useStore((s) => s.homeAction)
  const setHomeAction = useStore((s) => s.openHome)

  // If the user triggered "New Project" from the editor, auto-open the modal
  useEffect(() => {
    if (homeAction === 'new') {
      setCreatingEmpty(true)
      setHomeAction(null)
    }
  }, [homeAction, setHomeAction])

  const createSample = async (name: string) => {
    const p = await newProject(name, SAMPLE)
    showToast(`Created ${p.name}`, 'success')
  }
  const createEmpty = async (name: string) => {
    const p = await newProject(name, [])
    showToast(`Created ${p.name}`, 'success')
  }

  return (
    <div className="bg-app flex h-dvh flex-col">
      <header className="border-b border-ink/10 p-4 dark:border-white/10">
        <h1 className="flex items-center gap-2 text-xl font-bold text-ink"><VscCode className="text-accent" /> CodeFlow</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">Your mobile code editor</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {projects.length ? (
          <div className="space-y-2">
            <h2 className="px-1 text-[12px] font-bold uppercase tracking-wider text-ink-muted">Recent projects</h2>
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => setActiveProject(p.id)}
                className="flex cursor-pointer items-center gap-3 rounded-xl bg-white/5 px-4 py-3 active:bg-white/10"
              >
                <span className="text-accent"><VscFolderOpened /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-ink">{p.name}</div>
                  <div className="text-[12px] text-ink-muted">{relativeTime(p.lastOpenedAt)}{p.github.connected ? ` · ${p.github.owner}/${p.github.repo}` : ''}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete project "${p.name}"?`)) { deleteProject(p.id); showToast(`Deleted ${p.name}`, 'success') } }}
                  aria-label="Delete project"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted active:bg-red-500/20 active:text-red-400"
                >
                  <VscTrash />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <FaFolderOpen className="text-5xl text-ink-muted" />
            <p className="text-ink-muted">No projects yet. Create your first one.</p>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-ink/10 p-4 dark:border-white/10">
        <button onClick={() => setCreating(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-white active:opacity-90">
          <AiOutlinePlus /> New project (with sample files)
        </button>
        <button onClick={() => setCreatingEmpty(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink/15 px-4 py-3 font-medium text-ink active:bg-white/5">
          New empty project
        </button>
      </div>

      <NameModal open={creating} title="New project" placeholder="Project name" submitLabel="Create" onClose={() => setCreating(false)} onSubmit={createSample} />
      <NameModal open={creatingEmpty} title="New empty project" placeholder="Project name" submitLabel="Create" onClose={() => setCreatingEmpty(false)} onSubmit={createEmpty} />
    </div>
  )
}
