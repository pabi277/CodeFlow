import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWA() {
  const setOffline = useStore((s) => s.setOffline)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [dismissedAt] = useState<number>(() => {
    try { return Number(localStorage.getItem('cf_install_dismissed') || 0) } catch { return 0 }
  })

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    const onInstall = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
      // Show banner after 2 minutes of usage
      const start = Number(sessionStorage.getItem('cf_start') || Date.now())
      sessionStorage.setItem('cf_start', String(start))
      const elapsed = Date.now() - start
      if (elapsed > 2 * 60 * 1000 && Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000) {
        setCanInstall(true)
      }
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('beforeinstallprompt', onInstall)
    setOffline(!navigator.onLine)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('beforeinstallprompt', onInstall)
    }
  }, [setOffline, dismissedAt])

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    setCanInstall(false)
  }
  const dismiss = () => {
    setCanInstall(false)
    try { localStorage.setItem('cf_install_dismissed', String(Date.now())) } catch {}
  }

  return { canInstall, install, dismiss, offline: useStore.getState().offline }
}
