import { useState, useEffect } from 'react'
import { IS_APPLE } from '@lexical/utils'
import { getAllShortcuts } from '@/lib/lexical/universal/constants/actions'

export const SHORTCUTS = getAllShortcuts()

function formatShortcutCombo (combo) {
  if (!combo) return ''
  return combo
    .replace('mod', IS_APPLE ? '⌘' : 'ctrl')
    .replace('alt', IS_APPLE ? '⌥' : 'alt')
    .replace('ctrl', IS_APPLE ? 'control' : 'ctrl')
    .toLowerCase()
}

/**
 * Hook to get keyboard shortcut combo for display
 * Returns empty string during SSR and initial render to avoid hydration mismatch
 */
export function useShortcutCombo (id) {
  const [combo, setCombo] = useState('')

  useEffect(() => {
    const shortcut = SHORTCUTS.find(shortcut => shortcut.id === id)
    if (shortcut?.combo) {
      setCombo(formatShortcutCombo(shortcut.combo))
    }
  }, [id])

  return combo
}

// Legacy function - kept for backward compatibility but prefer useShortcutCombo hook
export function getShortcutCombo (id) {
  const shortcut = SHORTCUTS.find(shortcut => shortcut.id === id)
  if (!shortcut?.combo) return ''
  return formatShortcutCombo(shortcut.combo)
}
