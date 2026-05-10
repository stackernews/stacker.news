import { createContext, useMemo, useContext, useCallback } from 'react'
import useLocalState from '@/components/use-local-state'

export const MARKDOWN_MODE = 'markdown'
export const RICH_MODE = 'rich'

const STORAGE_KEY = 'editor:mode'

const EditorModeContext = createContext()

export function EditorModeProvider ({ children }) {
  const [mode, setMode] = useLocalState(STORAGE_KEY, MARKDOWN_MODE)

  const changeMode = useCallback((newMode) => {
    if (newMode !== MARKDOWN_MODE && newMode !== RICH_MODE) {
      throw new Error(`Invalid mode: ${newMode}`)
    }
    setMode(newMode)
  }, [setMode])

  const toggleMode = useCallback(() => {
    setMode(mode === MARKDOWN_MODE ? RICH_MODE : MARKDOWN_MODE)
  }, [mode, setMode])

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
