import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { relativeTime } from '../utils/format'
import { SITE } from '../config/site'
import { AiOutlinePlus, AiOutlineDownload, AiOutlineGithub, AiOutlineRight, AiOutlineCode, AiOutlineThunderbolt, AiOutlineEye, AiOutlineCloud } from 'react-icons/ai'
import { VscTrash, VscFolderOpened, VscQuestion, VscTerminal } from 'react-icons/vsc'
import { FiFolder } from 'react-icons/fi'
import { NameModal } from './Shared/NameModal'

const SAMPLE = [
  { path: 'main.py', content: '# Imports util.py from the same project (needs Termux to run multi-file)\nfrom util import greet\n\ndef main():\n    name = input("Enter your name: ")\n    print(greet(name))\n\nif __name__ == "__main__":\n    main()\n' },
  { path: 'util.py', content: 'def greet(name: str) -> str:\n    return f"Hello, {name}!"\n' },
  { path: 'hello.js', content: '// JavaScript runs locally without an API key\nconst name = "CodeFlow";\nconsole.log("Hello, " + name + "!");\nfor (let i = 1; i <= 3; i++) console.log("Count: " + i);\n' },
  { path: 'readme.md', content: '# My Project\n\nWelcome to **CodeFlow** — a mobile-first code editor PWA.\n\n- Tap a file in the explorer to open it\n- Tap ▶ to run the active file\n- Long-press a file for more options\n- Open this file and tap the eye icon for a live preview\n\n```python\nprint("You can preview fenced code too")\n```\n\n| Shortcut | Action |\n| --- | --- |\n| Ctrl/Cmd+P | Command palette |\n| Ctrl/Cmd+G | Go to line |\n' },
  { path: 'preview.html', content: '<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8"/>\n  <title>CodeFlow Preview</title>\n  <link rel="stylesheet" href="css/style.css">\n</head>\n<body>\n  <div class="card">\n    <h1>Hello from CodeFlow</h1>\n    <p>Linked <code>css/style.css</code> and <code>js/app.js</code> load in preview.</p>\n    <button id="go">Tap me</button>\n  </div>\n  <script src="js/app.js"></script>\n</body>\n</html>\n' },
  { path: 'css/style.css', content: 'body {\n  font-family: system-ui, sans-serif;\n  background: #0f172a;\n  color: #e2e8f0;\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n  margin: 0;\n}\n.card {\n  background: #1e293b;\n  padding: 28px 32px;\n  border-radius: 16px;\n  box-shadow: 0 20px 50px rgba(0,0,0,.35);\n  text-align: center;\n}\nh1 { margin: 0 0 8px; font-size: 1.6rem; }\np { margin: 0; color: #94a3b8; }\nbutton {\n  margin-top: 16px;\n  background: #38bdf8;\n  border: 0;\n  color: #0f172a;\n  font-weight: 700;\n  padding: 8px 14px;\n  border-radius: 8px;\n}\n' },
  { path: 'js/app.js', content: 'const btn = document.getElementById("go");\nif (btn) {\n  btn.addEventListener("click", () => {\n    btn.textContent = "CSS + JS loaded!";\n  });\n}\n' },
]

const FEATURES: { icon: typeof AiOutlineCode; label: string }[] = [
  { icon: AiOutlineCode, label: 'Edit' },
  { icon: AiOutlineThunderbolt, label: 'Run' },
  { icon: AiOutlineEye, label: 'Preview' },
  { icon: AiOutlineCloud, label: 'Offline' },
  { icon: VscTerminal, label: 'Termux' },
  { icon: AiOutlineGithub, label: 'GitHub' },
]

export function Home() {
  const projects = useStore((s) => s.projects)
  const setActiveProject = useStore((s) => s.setActiveProject)
  const newProject = useStore((s) => s.newProject)
  const deleteProject = useStore((s) => s.deleteProject)
  const showToast = useStore((s) => s.showToast)
  const setImportProjectOpen = useStore((s) => s.setImportProjectOpen)
  const setShortcutsOpen = useStore((s) => s.setShortcutsOpen)
  const setWelcomeOpen = useStore((s) => s.setWelcomeOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const [creating, setCreating] = useState(false)
  const [creatingEmpty, setCreatingEmpty] = useState(false)
  const homeAction = useStore((s) => s.homeAction)
  const setHomeAction = useStore((s) => s.openHome)

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
      <header className="home-hero p-4 pb-5 pt-6">
        <div className="relative flex items-start justify-between gap-2">
          <div className="animate-fade-up">
            <div className="flex items-center gap-3">
              <span className="icon-tile animate-pop flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-glow">
                <AiOutlineCode size={26} strokeWidth={20} />
              </span>
              <div>
                <h1 className="text-gradient text-2xl font-extrabold tracking-tight">{SITE.name}</h1>
                <p className="text-[12px] text-ink-muted">{SITE.tagline}</p>
              </div>
            </div>
          </div>
          <button onClick={() => setShortcutsOpen(true)} aria-label="Keyboard shortcuts" className="chip flex h-10 w-10 items-center justify-center rounded-xl transition-transform active:scale-90">
            <VscQuestion />
          </button>
        </div>
        <div className="animate-fade-up relative mt-4 flex flex-wrap gap-1.5" style={{ ['--i' as string]: 1 }}>
          {FEATURES.map(({ icon: Icon, label }) => (
            <span key={label} className="glass flex items-center gap-1.5 rounded-full border border-border/40 px-2.5 py-1 text-[11px] font-medium text-ink shadow-card">
              <Icon className="text-accent" size={13} /> {label}
            </span>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {projects.length ? (
          <div className="space-y-2">
            <h2 className="animate-fade-up flex items-center gap-2 px-1 text-[12px] font-bold uppercase tracking-wider text-ink-muted">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
              Recent projects
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
            </h2>
            <div className="stagger-in space-y-2">
              {projects.map((p, i) => (
                <div
                  key={p.id}
                  style={{ ['--i' as string]: i }}
                  onClick={() => setActiveProject(p.id)}
                  className="card-lift group flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3"
                  role="button"
                  aria-label={`Open ${p.name}`}
                >
                  <span className="icon-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white">
                    <VscFolderOpened size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-ink">{p.name}</div>
                    <div className="truncate text-[12px] text-ink-muted">
                      {relativeTime(p.lastOpenedAt)}
                      {p.github.connected ? ` · ${p.github.owner}/${p.github.repo}` : ''}
                    </div>
                  </div>
                  {p.github.connected && (
                    <span className="chip shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                      Git
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete project "${p.name}"?`)) { deleteProject(p.id); showToast(`Deleted ${p.name}`, 'success') } }}
                    aria-label="Delete project"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-red-500/15 hover:text-red-400 active:bg-red-500/20 active:text-red-400"
                  >
                    <VscTrash />
                  </button>
                  <AiOutlineRight className="shrink-0 text-ink-muted/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <span className="icon-tile animate-float-slow flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-glow">
              <FiFolder size={36} />
            </span>
            <h2 className="animate-fade-up text-[17px] font-bold text-ink" style={{ ['--i' as string]: 1 }}>Start in 10 seconds</h2>
            <p className="animate-fade-up max-w-xs text-[13px] leading-relaxed text-ink-muted" style={{ ['--i' as string]: 2 }}>
              Create a sample project to try run, preview, and Git — or import a ZIP you already have.
            </p>
            <button onClick={() => setWelcomeOpen(true)} className="animate-fade-up text-[13px] font-semibold text-accent transition-transform active:scale-95" style={{ ['--i' as string]: 3 }}>
              How does it work? →
            </button>
          </div>
        )}
      </div>

      <div className="glass space-y-2 border-t border-border/50 p-4 pt-3">
        <button onClick={() => setCreating(true)} className="btn-primary btn-shine flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-semibold text-white">
          <AiOutlinePlus size={18} strokeWidth={24} /> New project (with sample files)
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setCreatingEmpty(true)} className="card-lift rounded-xl px-3 py-3 text-[13px] font-medium text-ink">
            Empty project
          </button>
          <button onClick={() => setImportProjectOpen(true)} className="card-lift flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-[13px] font-medium text-ink">
            <AiOutlineDownload className="text-accent" /> Import
          </button>
        </div>
        <div className="flex items-center justify-between pt-1 text-[11px] text-ink-muted">
          <button onClick={() => setSettingsOpen(true)} className="text-ink-muted transition-colors hover:text-accent">Settings</button>
          <a href={SITE.repo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-muted transition-colors hover:text-accent">
            <AiOutlineGithub /> MIT · GitHub
          </a>
        </div>
      </div>

      <NameModal open={creating} title="New project" placeholder="Project name" submitLabel="Create" onClose={() => setCreating(false)} onSubmit={createSample} />
      <NameModal open={creatingEmpty} title="New empty project" placeholder="Project name" submitLabel="Create" onClose={() => setCreatingEmpty(false)} onSubmit={createEmpty} />
    </div>
  )
}
