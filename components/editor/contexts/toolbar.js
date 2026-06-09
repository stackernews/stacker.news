import { createContext, useContext, useMemo, useState, useCallback } from 'react'

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

  const batchUpdateToolbarState = useCallback((updates) => {
    setToolbarState((prev) => ({ ...prev, ...updates }))
  }, [])

  const updateToolbarState = useCallback((key, value) => {
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
