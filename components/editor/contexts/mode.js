import { createContext, useState, useMemo, useContext, useCallback, useEffect } from 'react'

export const MARKDOWN_MODE = 'markdown'
export const RICH_MODE = 'rich'

// remember the last used mode across editors and sessions (#2858)
const MODE_STORAGE_KEY = 'editorMode'

const EditorModeContext = createContext()

export function EditorModeProvider ({ children }) {
  const [mode, setMode] = useState(MARKDOWN_MODE)

  // restored after mount so SSR markup (markdown mode) stays consistent during hydration
  useEffect(() => {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY)
    if (stored === MARKDOWN_MODE || stored === RICH_MODE) {
      setMode(stored)
    }
  }, [])

  const changeMode = useCallback((newMode) => {
    if (newMode !== MARKDOWN_MODE && newMode !== RICH_MODE) {
      throw new Error(`Invalid mode: ${newMode}`)
    }
    setMode(newMode)
    window.localStorage.setItem(MODE_STORAGE_KEY, newMode)
  }, [])

  const toggleMode = useCallback(() => {
    setMode(prev => prev === MARKDOWN_MODE ? RICH_MODE : MARKDOWN_MODE)
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
