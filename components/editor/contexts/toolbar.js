import { createContext, useContext, useMemo, useState, useCallback } from 'react'
import { SSR } from '@/lib/constants'

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

const STORAGE_KEY = 'editor:showToolbar'

const INITIAL_STATE = {
  showToolbar: false,
  ...INITIAL_FORMAT_STATE
}

const ToolbarContext = createContext()

function getInitialShowToolbar (topLevel) {
  if (!SSR) {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      return JSON.parse(stored)
    }
  }
  return !!topLevel
}

export function ToolbarContextProvider ({ topLevel, children }) {
  const [toolbarState, setToolbarState] = useState(() => ({ ...INITIAL_STATE, showToolbar: getInitialShowToolbar(topLevel) }))

  const batchUpdateToolbarState = useCallback((updates) => {
    setToolbarState((prev) => ({ ...prev, ...updates }))
  }, [])

  const updateToolbarState = useCallback((key, value) => {
    if (key === 'showToolbar' && !SSR) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
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
