import { createContext, useContext, useMemo, useState, useCallback } from 'react'

const INITIAL_STATE = {
  showToolbar: false,
  markdownMode: true,
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

const ToolbarContext = createContext()

export const ToolbarContextProvider = ({ children }) => {
  const [toolbarState, setToolbarState] = useState(INITIAL_STATE)

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

export const useToolbarState = () => {
  return useContext(ToolbarContext)
}
