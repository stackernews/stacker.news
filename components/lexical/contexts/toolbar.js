import { createContext, useContext, useMemo, useState, useCallback } from 'react'

const INITIAL_STATE = {
  isBold: false,
  isCode: false,
  isHighlight: false,
  isImageCaption: false,
  isItalic: false,
  isLink: false,
  isRTL: false,
  isStrikethrough: false,
  isSubscript: false,
  isSuperscript: false,
  isUnderline: false,
  isLowercase: false,
  isUppercase: false,
  isCapitalize: false,
  canRedo: false,
  canUndo: false
}

const ToolbarContext = createContext()

export const ToolbarContextProvider = ({ children }) => {
  const [toolbarState, setToolbarState] = useState(INITIAL_STATE)

  const updateToolbarState = useCallback((key, value) => {
    setToolbarState((prev) => ({
      ...prev,
      [key]: value
    }))
  }, [])

  const contextValue = useMemo(() => {
    return { toolbarState, updateToolbarState }
  }, [toolbarState, updateToolbarState])

  return (
    <ToolbarContext.Provider value={contextValue}>
      {children}
    </ToolbarContext.Provider>
  )
}

export const useToolbarState = () => {
  return useContext(ToolbarContext)
}
