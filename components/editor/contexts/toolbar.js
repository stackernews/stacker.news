import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import { EDITOR_TOOLBAR_STORAGE_KEY, readEditorToolbarVisibility, writeEditorSetting } from '@/lib/editor-settings'

export const INITIAL_FORMAT_STATE = {
  blockType: 'paragraph',
  elementFormat: 'left',
  isLink: false,
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  isCode: false,
  isHighlight: false,
  isSubscript: false,
  isSuperscript: false,
  isLowercase: false,
  isUppercase: false,
  isCapitalize: false,
  codeLanguage: null
}

const INITIAL_STATE = {
  showToolbar: false,
  ...INITIAL_FORMAT_STATE
}

const ToolbarContext = createContext()

export function ToolbarContextProvider ({ topLevel, children }) {
  const [toolbarState, setToolbarState] = useState({ ...INITIAL_STATE, showToolbar: !!topLevel })

  useEffect(() => {
    setToolbarState(prev => ({
      ...prev,
      showToolbar: readEditorToolbarVisibility(window.localStorage, !!topLevel)
    }))
  }, [topLevel])

  const batchUpdateToolbarState = useCallback((updates) => {
    setToolbarState((prev) => ({ ...prev, ...updates }))
  }, [])

  const updateToolbarState = useCallback((key, value) => {
    if (key === 'showToolbar') {
      writeEditorSetting(window.localStorage, EDITOR_TOOLBAR_STORAGE_KEY, value)
    }
    setToolbarState((prev) => ({
      ...prev,
      [key]: value
    }))
  }, [])

  const contextValue = useMemo(() => {
    return { toolbarState, updateToolbarState, batchUpdateToolbarState }
  }, [toolbarState, updateToolbarState, batchUpdateToolbarState])

  return (
    <ToolbarContext.Provider value={contextValue}>
      {children}
    </ToolbarContext.Provider>
  )
}

export function useToolbarState () {
  return useContext(ToolbarContext)
}
