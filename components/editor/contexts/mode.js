import { createContext, useState, useMemo, useContext, useCallback } from 'react'

export const MARKDOWN_MODE = 'markdown'
export const RICH_MODE = 'rich'

const STORAGE_KEY = 'sn:editor:mode'

const EditorModeContext = createContext()

function isValidMode (mode) {
  return mode === MARKDOWN_MODE || mode === RICH_MODE
}

function getInitialMode () {
  if (typeof window === 'undefined') return MARKDOWN_MODE

  try {
    const mode = window.localStorage.getItem(STORAGE_KEY)
    return isValidMode(mode) ? mode : MARKDOWN_MODE
  } catch {
    return MARKDOWN_MODE
  }
}

function saveMode (mode) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {}
}

export function EditorModeProvider ({ children }) {
  const [mode, setMode] = useState(getInitialMode)

  const changeMode = useCallback((newMode) => {
    if (!isValidMode(newMode)) {
      throw new Error(`Invalid mode: ${newMode}`)
    }
    setMode(newMode)
    saveMode(newMode)
  }, [])

  const toggleMode = useCallback(() => {
    setMode(prev => {
      const newMode = prev === MARKDOWN_MODE ? RICH_MODE : MARKDOWN_MODE
      saveMode(newMode)
      return newMode
    })
  }, [])

  const value = useMemo(() => ({
    mode,
    changeMode,
    isMarkdown: mode === MARKDOWN_MODE,
    isRich: mode === RICH_MODE,
    toggleMode
  }), [mode, changeMode, toggleMode])

  return (
    <EditorModeContext.Provider value={value}>
      {children}
    </EditorModeContext.Provider>
  )
}

export function useEditorMode () {
  return useContext(EditorModeContext)
}
