import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { VscCode, VscPlay, VscEye, VscGithub } from 'react-icons/vsc'

const KEY = 'codeflow.welcome.v1'

const SLIDES = [
  {
    icon: VscCode,
    title: 'Code anywhere',
    body: 'CodeFlow is a full editor in your browser. Create a sample project to try Python, JavaScript, and a live HTML page — no install required.',
  },
  {
    icon: VscPlay,
    title: 'Tap ▶ to run',
    body: 'JavaScript runs instantly. Connect Termux (Settings → Execution) to run Python with real imports, or add a Judge0 key for the cloud.',
  },
  {
    icon: VscEye,
    title: 'Preview the web',
    body: 'Open an HTML file and tap the eye icon. CSS and JS load from your project. With Termux you get a live server and an optional new tab.',
  },
]

export function shouldShowWelcome(): boolean {
  try {
    return localStorage.getItem(KEY) !== '1'
  } catch {
    return true
  }
}

export function markWelcomeSeen() {
  try { localStorage.setItem(KEY, '1') } catch { /* ignore */ }
}

export function WelcomeTour() {
  const open = useStore((s) => s.welcomeOpen)
  const setOpen = useStore((s) => s.setWelcomeOpen)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  if (!open) return null

  const slide = SLIDES[step]
  const Icon = slide.icon
  const last = step === SLIDES.length - 1

  const finish = () => {
    markWelcomeSeen()
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Welcome to CodeFlow">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[6px]" onClick={finish} />
      <div className="glass relative m-3 w-full max-w-md overflow-hidden rounded-3xl border border-border/60 shadow-modal animate-sheet-up">
        <div className="p-6 pb-4 pt-7 text-center">
          <div className="animate-pop mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl icon-tile text-white shadow-glow">
            <Icon size={30} />
          </div>
          <h2 className="animate-fade-up text-xl font-bold text-ink">{slide.title}</h2>
          <p className="animate-fade-up mt-2 text-[14px] leading-relaxed text-ink-muted" style={{ ['--i' as string]: 1 }}>{slide.body}</p>
        </div>
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {SLIDES.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-accent shadow-glow' : 'w-1.5 bg-ink/20'}`} />
          ))}
        </div>
        <div className="flex gap-2 border-t border-border/50 p-4">
          <button onClick={finish} className="flex-1 rounded-xl border border-ink/15 px-4 py-3 text-[14px] text-ink transition-colors active:bg-white/5">
            Skip
          </button>
          {last ? (
            <button onClick={finish} className="btn-primary btn-shine flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold text-white">
              <VscGithub /> Start coding
            </button>
          ) : (
            <button onClick={() => setStep((s) => s + 1)} className="btn-primary flex-1 rounded-xl px-4 py-3 text-[14px] font-semibold text-white">
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
