import { createContext, useState, useMemo, useContext, useCallback } from 'react'

export const MARKDOWN_MODE = 'markdown'
export const RICH_MODE = 'rich'

const EditorModeContext = createContext()

export function EditorModeProvider ({ children }) {
  const [mode, setMode] = useState(MARKDOWN_MODE)

  const changeMode = useCallback((newMode) => {
    if (newMode !== MARKDOWN_MODE && newMode !== RICH_MODE) {
      throw new Error(`Invalid mode: ${newMode}`)
    }
    setMode(newMode)
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
