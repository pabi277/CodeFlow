// Lightweight plugin architecture.
//
// A plugin registers a name, an icon, and a React component (its panel), plus
// optional command-palette entries. Plugins can be toggled on/off at runtime.
// Built-in plugins ship in `./builtin`; the registry here is the contract the
// UI (CommandPalette, Drawer) consumes so adding a plugin is just a matter of
// registering it.

import type { ComponentType } from 'react'
import { useStore } from '../store/useStore'

export interface PluginCommand {
  label: string
  run: () => void
}

export interface CodeFlowPlugin {
  id: string
  name: string
  description?: string
  /** Feather icon component (react-icons/fi) */
  Icon?: ComponentType<{ className?: string }>
  /** Optional full panel rendered as an overlay when opened */
  Panel?: ComponentType
  commands?: PluginCommand[]
}

const registry = new Map<string, CodeFlowPlugin>()
const enabled = new Set<string>()

export function registerPlugin(p: CodeFlowPlugin) {
  registry.set(p.id, p)
  enabled.add(p.id)
}

export function unregisterPlugin(id: string) {
  registry.delete(id)
  enabled.delete(id)
}

export function setPluginEnabled(id: string, on: boolean) {
  if (on) enabled.add(id)
  else enabled.delete(id)
}

export function isPluginEnabled(id: string) {
  return enabled.has(id)
}

export function listPlugins(): CodeFlowPlugin[] {
  return Array.from(registry.values())
}

export function listEnabledPlugins(): CodeFlowPlugin[] {
  return listPlugins().filter((p) => enabled.has(p.id))
}

export function getPlugin(id: string): CodeFlowPlugin | undefined {
  return registry.get(id)
}

/** Collect all commands from enabled plugins (used by CommandPalette). */
export function collectPluginCommands(): PluginCommand[] {
  const out: PluginCommand[] = []
  for (const p of listEnabledPlugins()) {
    for (const c of p.commands || []) out.push({ ...c, label: `${p.name}: ${c.label}` })
  }
  return out
}

export function pluginUiState() {
  const s = useStore.getState()
  return {
    openPluginPanel: (id: string) => s.openPluginPanel(id),
    closePluginPanel: () => s.closePluginPanel(),
    activePluginPanel: s.activePluginPanel,
  }
}
