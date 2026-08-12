import { useState } from 'react'
import { useStore } from '../store/useStore'
import { insertSnippet } from '../utils/editorApi'
import { FiChevronLeft, FiPlus, FiTrash2, FiCopy } from 'react-icons/fi'
import { LANG_LABELS } from '../config/labels'

export function SnippetLibrary() {
  const open = useStore((s) => s.snippetsOpen)
  const close = useStore((s) => s.setSnippetsOpen)
  const snippets = useStore((s) => s.snippets)
  const addSnippet = useStore((s) => s.addSnippet)
  const deleteSnippet = useStore((s) => s.deleteSnippet)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [lang, setLang] = useState('')
  const [body, setBody] = useState('')

  if (!open) return null

  const filtered = lang ? snippets.filter((s) => s.language === lang) : snippets

  const save = async () => {
    if (!name.trim() || !body.trim()) return
    await addSnippet({ name: name.trim(), description: desc.trim(), language: lang, body })
    setCreating(false)
    setName(''); setDesc(''); setBody('')
  }

  const insert = (body: string) => {
    insertSnippet(body)
    close(false)
  }

  return (
    <div className="fixed inset-0 z-[50] flex flex-col bg-surface animate-drawer-in dark:bg-panel" role="dialog" aria-label="Snippet library">
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-2">
        <button onClick={() => close(false)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink active:bg-black/5 dark:active:bg-white/5">
          <FiChevronLeft />
        </button>
        <h1 className="flex-1 text-lg font-semibold text-ink">Snippets</h1>
        <button onClick={() => setCreating(true)} aria-label="New snippet" className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white active:opacity-90">
          <FiPlus />
        </button>
      </div>

      <div className="border-b border-border/60 px-3 py-2">
        <div className="flex gap-1 overflow-x-auto">
          <LangChip label="All" active={!lang} onClick={() => setLang('')} />
          {Object.keys(LANG_LABELS).filter((k) => k !== 'default').map((k) => (
            <LangChip key={k} label={LANG_LABELS[k]} active={lang === k} onClick={() => setLang(lang === k ? '' : k)} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-24">
        {creating ? (
          <div className="space-y-2 rounded-xl bg-white/5 p-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Snippet name (e.g. for loop)" className="w-full rounded-lg border border-ink/15 bg-input px-3 py-2 text-[14px] text-ink outline-none focus:border-accent" />
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" className="w-full rounded-lg border border-ink/15 bg-input px-3 py-2 text-[13px] text-ink outline-none focus:border-accent" />
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="w-full rounded-lg border border-ink/15 bg-input px-3 py-2 text-[13px] text-ink outline-none">
              <option value="">Any language</option>
              {Object.entries(LANG_LABELS).filter(([k]) => k !== 'default').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder={"Code body… ${cursor} or $1 / ${name} tab-stops"} className="w-full resize-none rounded-lg border border-ink/15 bg-input px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-accent" />
            <div className="flex gap-2">
              <button onClick={save} className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white">Save Snippet</button>
              <button onClick={() => setCreating(false)} className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink">Cancel</button>
            </div>
          </div>
        ) : filtered.length ? (
          filtered.map((s) => (
            <div key={s.id} className="mb-2 rounded-xl bg-white/5 p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{s.name}</span>
                {s.language && <span className="shrink-0 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">{LANG_LABELS[s.language] || s.language}</span>}
                <button onClick={() => deleteSnippet(s.id)} aria-label="Delete" className="shrink-0 text-ink-muted active:text-red-400"><FiTrash2 /></button>
              </div>
              {s.description && <p className="mt-0.5 text-[12px] text-ink-muted">{s.description}</p>}
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/20 p-2 text-[11px] text-ink">{s.body}</pre>
              <button onClick={() => insert(s.body)} className="mt-2 flex items-center gap-1.5 rounded-lg bg-accent/20 px-3 py-1.5 text-[12px] font-medium text-accent active:opacity-80">
                <FiCopy /> Insert
              </button>
            </div>
          ))
        ) : (
          <p className="py-10 text-center text-[13px] text-ink-muted">No snippets{lang ? ` for ${LANG_LABELS[lang]}` : ''}. Tap + to add one.</p>
        )}
      </div>
    </div>
  )
}

function LangChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] ${active ? 'bg-accent text-white' : 'bg-white/5 text-ink-muted'}`}>
      {label}
    </button>
  )
}
