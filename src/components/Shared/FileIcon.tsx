import { getFileIcon } from '../../utils/getFileIcon'

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
