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
  json: VscJson,
  sql: AiOutlineDatabase,
}

// Generic file fallback
const FILE_ICON: IconType = AiOutlineFile
const CONFIG_ICON: IconType = VscCode

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
    return { Icon: langIcon, colorClass: '' }
  }
  if (/\.(yaml|yml|xml|toml|ini|conf|config)$/i.test(fileName)) {
    return { Icon: CONFIG_ICON, colorClass: '' }
  }
  return { Icon: FILE_ICON, colorClass: '' }
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
