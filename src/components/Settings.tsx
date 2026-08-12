import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { formatBytes } from '../utils/format'
import { THEME_PRESETS, FONT_FAMILIES, DEFAULT_TOOLBAR_KEYS } from '../config/defaults'
import { listPlugins, isPluginEnabled, setPluginEnabled } from '../plugins/registry'
import { VscChevronLeft, VscClose, VscDebugAlt, VscExtensions, VscEdit, VscSave, VscTrash } from 'react-icons/vsc'
import { MdColorLens, MdKeyboard } from 'react-icons/md'
import { AiOutlineDatabase, AiFillGithub, AiOutlineInfoCircle, AiOutlineCheckCircle, AiOutlineWarning, AiOutlineCopy, AiOutlineReload, AiOutlineDownload, AiOutlineCloudUpload } from 'react-icons/ai'
import type { IconType } from 'react-icons'

const LANG_LABELS: Record<string, string> = {
  default: 'All languages', python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript',
  c: 'C', cpp: 'C++', java: 'Java', go: 'Go', rust: 'Rust', shell: 'Shell', html: 'HTML', css: 'CSS',
}

export function Settings() {
  const open = useStore((s) => s.settingsOpen)
  const setOpen = useStore((s) => s.setSettingsOpen)
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const nodeMap = useStore((s) => s.nodeMap)
  const showToast = useStore((s) => s.showToast)
  const auth = useStore((s) => s.auth)
  const disconnectGitHub = useStore((s) => s.disconnectGitHub)
  const rateLimit = useStore((s) => s.rateLimit)
  const loadRateLimit = useStore((s) => s.loadRateLimit)
  const termuxAvailable = useStore((s) => s.termuxAvailable)
  const refreshTermuxStatus = useStore((s) => s.refreshTermuxStatus)
  const exportProjectZip = useStore((s) => s.exportProjectZip)
  const setImportProjectOpen = useStore((s) => s.setImportProjectOpen)
  const deleteProject = useStore((s) => s.deleteProject)
  const openHome = useStore((s) => s.openHome)
  const clearHistory = useStore((s) => s.clearHistory)
  const activeProject = useStore((s) => s.projects.find((p) => p.id === s.activeProjectId))

  const copyBridgeScript = async () => {
    try {
      const res = await fetch('/termux-bridge.js')
      const text = await res.text()
      await navigator.clipboard.writeText(text)
      showToast('Bridge script copied to clipboard', 'success')
    } catch {
      showToast('Could not copy script automatically. See docs/termux-setup.md', 'error')
    }
  }

  useEffect(() => {
    if (open && auth) loadRateLimit()
  }, [open, auth, loadRateLimit])

  if (!open) return null

  const usedBytes = Object.values(nodeMap).reduce((sum, n) => sum + (n.type === 'file' ? n.content.length : 0), 0)
  const resetInMin = rateLimit ? Math.max(0, Math.round((rateLimit.reset * 1000 - Date.now()) / 60000)) : 0

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[14px] text-ink">{label}</span>
      <button
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        className={`h-7 w-12 rounded-full p-1 transition-colors ${value ? 'bg-accent' : 'bg-ink/20'}`}
      >
        <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )

  const Section = ({ title, icon: Icon, children }: { title: string; icon?: IconType; children: React.ReactNode }) => (
    <div className="mb-6">
      <h3 className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
        {Icon && <Icon className="text-ink-muted" size={14} />}
        {title}
      </h3>
      <div className="rounded-xl bg-white/5 px-4">{children}</div>
    </div>
  )

  const Segmented = ({ value, options, onSelect }: { value: string; options: { v: string; label: string }[]; onSelect: (v: string) => void }) => (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onSelect(o.v)}
          className={`rounded-lg px-3 py-2 text-[12px] ${value === o.v ? 'bg-accent text-white' : 'bg-ink/10 text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )

  const updateToolbarKey = (lang: string, keys: string[]) => {
    update({ keyboardToolbarKeys: { ...settings.keyboardToolbarKeys, [lang]: keys } })
  }
  const removeKey = (lang: string, key: string) => {
    const current = settings.keyboardToolbarKeys[lang] || DEFAULT_TOOLBAR_KEYS[lang] || DEFAULT_TOOLBAR_KEYS.default
    updateToolbarKey(lang, current.filter((k) => k !== key))
  }
  const resetToolbar = (lang: string) => {
    const next = { ...settings.keyboardToolbarKeys }
    delete next[lang]
    update({ keyboardToolbarKeys: next })
    showToast('Toolbar reset to default', 'success')
  }

  return (
    <div className="fixed inset-0 z-[50] bg-surface animate-drawer-in dark:bg-panel" role="dialog" aria-label="Settings">
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-2">
        <button onClick={() => setOpen(false)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink active:bg-black/5 dark:active:bg-white/5">
          <VscChevronLeft />
        </button>
        <h1 className="flex-1 text-lg font-semibold text-ink">Settings</h1>
        <button onClick={() => setOpen(false)} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted active:bg-black/5 dark:active:bg-white/5">
          <VscClose />
        </button>
      </div>

      <div className="h-[calc(100dvh-56px)] overflow-y-auto p-4 pb-24">
        <Section title="Editor" icon={VscEdit}>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[14px] text-ink">Font size · {settings.fontSize}px</span>
            <input type="range" min={10} max={24} value={settings.fontSize} onChange={(e) => update({ fontSize: Number(e.target.value) })} className="w-40 accent-[var(--accent)]" />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[14px] text-ink">Font family</span>
            <select
              value={settings.fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value })}
              className="rounded-lg bg-input px-2 py-2 text-[13px] text-ink outline-none"
            >
              {Object.entries(FONT_FAMILIES).map(([k]) => (
                <option key={k} value={k}>{k.replace(/-/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[14px] text-ink">Tab size</span>
            <Segmented
              value={String(settings.tabSize)}
              options={[{ v: '2', label: '2' }, { v: '4', label: '4' }, { v: '8', label: '8' }]}
              onSelect={(v) => update({ tabSize: Number(v) })}
            />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[14px] text-ink">Indent with</span>
            <Segmented
              value={settings.indentWithSpaces ? 'spaces' : 'tabs'}
              options={[{ v: 'spaces', label: 'Spaces' }, { v: 'tabs', label: 'Tabs' }]}
              onSelect={(v) => update({ indentWithSpaces: v === 'spaces' })}
            />
          </div>
          <Toggle label="Word wrap" value={settings.wordWrap} onChange={(v) => update({ wordWrap: v })} />
          <Toggle label="Line numbers" value={settings.showLineNumbers} onChange={(v) => update({ showLineNumbers: v })} />
          <Toggle label="Bracket matching" value={settings.bracketMatching} onChange={(v) => update({ bracketMatching: v })} />
          <Toggle label="Code minimap" value={settings.showMinimap} onChange={(v) => update({ showMinimap: v })} />
          <Toggle label="Breadcrumbs" value={settings.showBreadcrumbs} onChange={(v) => update({ showBreadcrumbs: v })} />
          <Toggle label="Status bar" value={settings.showStatusBar} onChange={(v) => update({ showStatusBar: v })} />
        </Section>

        <Section title="Auto Save" icon={VscSave}>
          <Toggle label="Enable auto save" value={settings.autoSave} onChange={(v) => update({ autoSave: v })} />
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[14px] text-ink">Delay · {settings.autoSaveDelay}ms</span>
            <input type="range" min={500} max={5000} step={250} value={settings.autoSaveDelay} onChange={(e) => update({ autoSaveDelay: Number(e.target.value) })} className="w-40 accent-[var(--accent)]" />
          </div>
        </Section>

        <Section title="Appearance" icon={MdColorLens}>
          <div className="grid grid-cols-2 gap-2 py-3">
            {Object.entries(THEME_PRESETS).map(([key, p]) => (
              <button
                key={key}
                onClick={() => update({ themePreset: key })}
                className={`rounded-lg border px-3 py-2 text-left text-[12px] ${settings.themePreset === key ? 'border-accent' : 'border-ink/15'}`}
                style={{ backgroundColor: p.bg, color: p.text }}
              >
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block text-[10px] opacity-70">{p.dark ? 'Dark' : 'Light'}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[14px] text-ink">Cursor style</span>
            <Segmented
              value={settings.cursorStyle}
              options={[{ v: 'line', label: 'Line' }, { v: 'block', label: 'Block' }, { v: 'underline', label: 'Under' }]}
              onSelect={(v) => update({ cursorStyle: v as any })}
            />
          </div>
          <Toggle label="Smooth cursor animation" value={settings.smoothCursor} onChange={(v) => update({ smoothCursor: v })} />
        </Section>

        <Section title="Keyboard Toolbar" icon={MdKeyboard}>
          <Toggle label="Show keyboard toolbar" value={settings.showKeyboardToolbar} onChange={(v) => update({ showKeyboardToolbar: v })} />
          <p className="pt-1 text-[11px] text-ink-muted">Customize keys per language. Tap a key chip to remove it.</p>
          {Object.keys(LANG_LABELS).map((lang) => {
            const keys = settings.keyboardToolbarKeys[lang] || DEFAULT_TOOLBAR_KEYS[lang] || DEFAULT_TOOLBAR_KEYS.default
            return (
              <div key={lang} className="border-t border-border/40 py-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-ink">{LANG_LABELS[lang]}</span>
                  {settings.keyboardToolbarKeys[lang] && (
                    <button onClick={() => resetToolbar(lang)} className="text-[11px] text-accent">Reset</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {keys.map((k) => (
                    <button
                      key={k}
                      onClick={() => removeKey(lang, k)}
                      className="rounded bg-input px-2 py-1 text-[12px] font-mono text-ink active:opacity-60"
                      aria-label={`Remove ${k}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </Section>

        <Section title="Execution" icon={VscDebugAlt}>
          <div className="border-b border-border/40 py-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">Termux Integration</span>
              <button onClick={refreshTermuxStatus} className="flex items-center gap-1 text-[11px] text-accent">
                <AiOutlineReload /> Refresh
              </button>
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              {termuxAvailable ? (
                <span className="flex items-center gap-1 text-emerald-400"><AiOutlineCheckCircle /> Termux bridge connected</span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400"><AiOutlineWarning /> Termux bridge not running</span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-ink-muted">
              Termux is the backend: it runs Python with the whole project (imports work)
              and serves HTML/CSS/JS as a live preview server. Copy the latest v2 bridge
              script below if you still have the old one.
            </p>
            <div className="mt-2 flex gap-2">
              <button onClick={copyBridgeScript} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent/15 px-3 py-2 text-[12px] font-medium text-accent active:opacity-80">
                <AiOutlineCopy /> Copy Bridge Script
              </button>
            </div>
            <div className="mt-2 rounded-lg bg-white/5 p-2.5 text-[11px] leading-relaxed text-ink-muted">
              <b className="text-ink">Quick start:</b> install Termux → <span className="font-mono">pkg install nodejs python clang openjdk-17</span> → save bridge script as <span className="font-mono">termux-bridge.js</span> → run <span className="font-mono">node termux-bridge.js</span> → tap Refresh.
            </div>
          </div>
          <div className="py-2.5">
            <label className="mb-1 block text-[12px] text-ink-muted">Judge0 API key (RapidAPI)</label>
            <input
              value={settings.judge0ApiKey}
              onChange={(e) => update({ judge0ApiKey: e.target.value })}
              type="password"
              placeholder="Paste your Judge0 RapidAPI key…"
              className="w-full rounded-lg border border-ink/15 bg-input px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
            />
            <p className="mt-1 text-[11px] text-ink-muted">Without a key, JavaScript runs locally; other languages show sample output.</p>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[14px] text-ink">Time limit · {settings.timeLimit}s</span>
            <input type="range" min={1} max={10} value={settings.timeLimit} onChange={(e) => update({ timeLimit: Number(e.target.value) })} className="w-40 accent-[var(--accent)]" />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[14px] text-ink">Memory limit · {settings.memoryLimit}MB</span>
            <input type="range" min={128} max={512} step={32} value={settings.memoryLimit} onChange={(e) => update({ memoryLimit: Number(e.target.value) })} className="w-40 accent-[var(--accent)]" />
          </div>
        </Section>

        <Section title="GitHub" icon={AiFillGithub}>
          {auth ? (
            <>
              <div className="flex items-center gap-3 py-3">
                <img src={auth.avatarUrl} alt="" className="h-10 w-10 rounded-full bg-white/10" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-ink">{auth.displayName}</div>
                  <div className="text-[12px] text-ink-muted">@{auth.username}</div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border/40 py-2.5">
                <span className="text-[14px] text-ink">API rate limit</span>
                {rateLimit ? (
                  <span className="text-[13px] text-ink-muted">{rateLimit.remaining} of {rateLimit.limit} · resets in {resetInMin}m</span>
                ) : (
                  <button onClick={loadRateLimit} className="text-[12px] text-accent">Check status</button>
                )}
              </div>
              <button onClick={() => { if (window.confirm('Disconnect GitHub?')) { disconnectGitHub() } }} className="w-full py-3 text-left text-[14px] text-red-400">
                Disconnect GitHub
              </button>
            </>
          ) : (
            <p className="py-3 text-[14px] text-ink-muted">Not connected. Use the Git tab in the drawer to connect.</p>
          )}
        </Section>

        <Section title="Storage" icon={AiOutlineDatabase}>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[14px] text-ink">Current project usage</span>
            <span className="text-[14px] text-ink-muted">{formatBytes(usedBytes)}</span>
          </div>
          <button onClick={exportProjectZip} className="flex w-full items-center gap-2 py-3 text-left text-[14px] text-accent">
            <AiOutlineDownload /> Export project as ZIP
          </button>
          <button onClick={() => setImportProjectOpen(true)} className="flex w-full items-center gap-2 border-t border-border/40 py-3 text-left text-[14px] text-accent">
            <AiOutlineCloudUpload /> Import a project (ZIP / folder / files)
          </button>
          <button
            onClick={() => { if (window.confirm('Clear all execution history?')) void clearHistory() }}
            className="w-full border-t border-border/40 py-3 text-left text-[14px] text-red-400"
          >
            Clear execution history
          </button>
          {activeProject && (
            <button
              onClick={() => {
                if (window.confirm(`Delete project "${activeProject.name}" and all its files?`)) {
                  deleteProject(activeProject.id)
                  openHome()
                }
              }}
              className="flex w-full items-center gap-2 border-t border-border/40 py-3 text-left text-[14px] text-red-400"
            >
              <VscTrash /> Delete project "{activeProject.name}"
            </button>
          )}
        </Section>

        <Section title="Plugins" icon={VscExtensions}>
          {listPlugins().length ? (
            listPlugins().map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[14px] text-ink">{p.name}</div>
                  {p.description && <div className="text-[12px] text-ink-muted">{p.description}</div>}
                </div>
                <Toggle
                  label=""
                  value={isPluginEnabled(p.id)}
                  onChange={(v) => setPluginEnabled(p.id, v)}
                />
              </div>
            ))
          ) : (
            <p className="py-3 text-[14px] text-ink-muted">No plugins registered.</p>
          )}
        </Section>

        <Section title="About" icon={AiOutlineInfoCircle}>
          <p className="py-2.5 text-[14px] text-ink">CodeFlow v0.5.0 — open-source mobile IDE.</p>
          <p className="text-[12px] text-ink-muted">MIT licensed. Built with React, CodeMirror 6, Dexie, Zustand &amp; Tailwind.</p>
          <button onClick={() => { setOpen(false); useStore.getState().setShortcutsOpen(true) }} className="w-full border-t border-border/40 py-3 text-left text-[14px] text-accent">
            Keyboard shortcuts
          </button>
          <button onClick={() => { setOpen(false); useStore.getState().setWelcomeOpen(true) }} className="w-full border-t border-border/40 py-3 text-left text-[14px] text-accent">
            Show welcome tour
          </button>
          <a href="https://github.com/pabi277/CodeFlow" target="_blank" rel="noopener noreferrer" className="block w-full border-t border-border/40 py-3 text-[14px] text-accent">
            Source on GitHub
          </a>
        </Section>
      </div>
    </div>
  )
}
