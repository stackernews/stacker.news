import { createContext, useState, useMemo, useContext, useCallback, useEffect } from 'react'
import { EDITOR_MODE_STORAGE_KEY, readEditorMode, writeEditorSetting } from '@/lib/editor-settings'

export const MARKDOWN_MODE = 'markdown'
export const RICH_MODE = 'rich'

const EditorModeContext = createContext()

export function EditorModeProvider ({ children }) {
  const [mode, setMode] = useState(MARKDOWN_MODE)

  useEffect(() => {
    setMode(readEditorMode(window.localStorage, MARKDOWN_MODE))
  }, [])

  const changeMode = useCallback((newMode) => {
    if (newMode !== MARKDOWN_MODE && newMode !== RICH_MODE) {
      throw new Error(`Invalid mode: ${newMode}`)
    }
    setMode(newMode)
    writeEditorSetting(window.localStorage, EDITOR_MODE_STORAGE_KEY, newMode)
  }, [])

  const toggleMode = useCallback(() => {
    setMode(prev => {
      const next = prev === MARKDOWN_MODE ? RICH_MODE : MARKDOWN_MODE
      writeEditorSetting(window.localStorage, EDITOR_MODE_STORAGE_KEY, next)
      return next
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
