import { IS_APPLE } from '@lexical/utils'
import { getAllShortcuts } from '@/lib/lexical/universal/constants/actions'

export const SHORTCUTS = getAllShortcuts()

export function getShortcutCombo (id) {
  const shortcut = SHORTCUTS.find(shortcut => shortcut.id === id)
  if (!shortcut?.combo) return ''
  return shortcut.combo
    .replace('mod', IS_APPLE ? '⌘' : 'ctrl')
    .replace('alt', IS_APPLE ? '⌥' : 'alt')
    .replace('ctrl', IS_APPLE ? 'control' : 'ctrl')
    .toLowerCase()
}
