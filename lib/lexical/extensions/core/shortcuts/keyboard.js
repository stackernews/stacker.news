import { useState, useEffect } from 'react'
import { IS_APPLE } from '@lexical/utils'
import { getAllShortcuts } from '@/lib/lexical/universal/constants/actions'

const SHORTCUTS = getAllShortcuts()

function formatShortcutCombo (combo) {
  if (!combo) return ''
  return combo
    .replace('mod', IS_APPLE ? '⌘' : 'ctrl')
    .replace('alt', IS_APPLE ? '⌥' : 'alt')
    .replace('ctrl', IS_APPLE ? 'control' : 'ctrl')
    .toLowerCase()
}

/**
 * client-side hook to get OS-specific keyboard shortcut display string.
 * @param {string} actionId
 * @returns {string} the formatted shortcut combo or empty string
 */
export function useClientShortcut (actionId) {
  const [shortcut, setShortcut] = useState('')

  useEffect(() => {
    const action = SHORTCUTS.find(s => s.id === actionId)
    if (action?.combo) {
      setShortcut(formatShortcutCombo(action.combo))
    }
  }, [actionId])

  return shortcut
}
