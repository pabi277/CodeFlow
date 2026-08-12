import type { IconType } from 'react-icons'
import { FaFolder, FaFolderOpen, FaJava } from 'react-icons/fa'
import { DiJavascript1, DiPython, DiCss3, DiRuby, DiPhp } from 'react-icons/di'
import { SiTypescript, SiC, SiCplusplus, SiGo, SiRust, SiSwift, SiKotlin } from 'react-icons/si'
import { AiFillHtml5, AiOutlineFileMarkdown, AiOutlineDatabase, AiOutlineFile } from 'react-icons/ai'
import { VscJson, VscCode } from 'react-icons/vsc'
import { getExtension } from './path'

// Extension -> language icon (specialized code file icons)
const LANG_ICONS: Record<string, IconType> = {
  js: DiJavascript1,
  jsx: DiJavascript1,
  mjs: DiJavascript1,
  ts: SiTypescript,
  tsx: SiTypescript,
  py: DiPython,
  java: FaJava,
  c: SiC,
  h: SiC,
  cpp: SiCplusplus,
  cc: SiCplusplus,
  hpp: SiCplusplus,
  html: AiFillHtml5,
  htm: AiFillHtml5,
  css: DiCss3,
  scss: DiCss3,
  go: SiGo,
  rs: SiRust,
  rb: DiRuby,
  php: DiPhp,
  swift: SiSwift,
  kt: SiKotlin,
  md: AiOutlineFileMarkdown,
  markdown: AiOutlineFileMarkdown,
  json: VscJson,
  sql: AiOutlineDatabase,
  vue: VscCode,
  svg: AiOutlineFile,
  xml: VscCode,
  yaml: VscCode,
  yml: VscCode,
  toml: VscCode,
  ini: VscCode,
  sh: VscCode,
  bash: VscCode,
  zsh: VscCode,
  env: VscCode,
  lock: VscJson,
  txt: AiOutlineFile,
  less: DiCss3,
}

// Generic file fallback
const FILE_ICON: IconType = AiOutlineFile
const CONFIG_ICON: IconType = VscCode

const LANG_COLORS: Record<string, string> = {
  js: 'text-yellow-400', jsx: 'text-yellow-400', mjs: 'text-yellow-400',
  ts: 'text-blue-400', tsx: 'text-blue-400',
  py: 'text-blue-500',
  java: 'text-orange-400',
  c: 'text-slate-400', h: 'text-slate-400',
  cpp: 'text-pink-400', cc: 'text-pink-400', hpp: 'text-pink-400',
  html: 'text-orange-500', htm: 'text-orange-500',
  css: 'text-sky-400', scss: 'text-pink-400', less: 'text-indigo-400',
  go: 'text-cyan-400',
  rs: 'text-orange-400',
  rb: 'text-red-400',
  php: 'text-purple-400',
  swift: 'text-orange-500',
  kt: 'text-purple-300',
  md: 'text-slate-300', markdown: 'text-slate-300',
  json: 'text-yellow-300',
  sql: 'text-emerald-400',
  vue: 'text-emerald-400',
  yaml: 'text-rose-300', yml: 'text-rose-300',
  sh: 'text-green-400', bash: 'text-green-400', zsh: 'text-green-400',
}

export interface FileIconResult {
  Icon: IconType
  colorClass: string
}

/**
 * Return an appropriate icon component for a file or folder by name.
 * - folders: returns folder icons (closed/open variant)
 * - code files: returns a language-specific icon by extension
 * - unknown: returns a generic file icon
 */
export function getFileIcon(
  fileName: string,
  type: 'file' | 'folder' = 'file',
  isOpen = false,
): FileIconResult {
  if (type === 'folder') {
    return { Icon: isOpen ? FaFolderOpen : FaFolder, colorClass: 'text-amber-400' }
  }
  const ext = getExtension(fileName)
  const langIcon = LANG_ICONS[ext]
  if (langIcon) {
    return { Icon: langIcon, colorClass: LANG_COLORS[ext] || 'text-sky-400' }
  }
  if (/\.(yaml|yml|xml|toml|ini|conf|config)$/i.test(fileName)) {
    return { Icon: CONFIG_ICON, colorClass: 'text-slate-400' }
  }
  return { Icon: FILE_ICON, colorClass: 'text-ink-muted' }
}

export function FileIcon({ name, type, isOpen, size = 18, className = '' }: {
  name: string
  type: 'file' | 'folder'
  isOpen?: boolean
  size?: number
  className?: string
}) {
  const { Icon, colorClass } = getFileIcon(name, type, isOpen)
  return <Icon size={size} className={`${colorClass} ${className}`.trim()} aria-hidden="true" />
}
