const KEY = 'codeflow.welcome.v1'

export function shouldShowWelcome(): boolean {
  try {
    return localStorage.getItem(KEY) !== '1'
  } catch {
    return true
  }
}

export function markWelcomeSeen() {
  try { localStorage.setItem(KEY, '1') } catch { /* storage can be unavailable */ }
}
