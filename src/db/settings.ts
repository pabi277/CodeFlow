import { db } from './db'
import { DEFAULT_SETTINGS, shouldDefaultWordWrapOn } from '../config/defaults'
import type { AppSettings } from '../types'

const KEY = 'app_settings'

export async function loadSettings(): Promise<AppSettings> {
  const row = await db.settings.get(KEY)
  if (row?.value) {
    return { ...DEFAULT_SETTINGS, ...(row.value as Partial<AppSettings>) }
  }
  // First launch: derive a device-appropriate word-wrap default (touch/narrow),
  // then honour the toggle forever after.
  return { ...DEFAULT_SETTINGS, wordWrap: shouldDefaultWordWrapOn() }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ key: KEY, value: settings })
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await loadSettings()), ...patch }
  await saveSettings(next)
  return next
}
