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

const STORAGE_KEY = 'sn:editor:show-toolbar'

const ToolbarContext = createContext()

function getInitialShowToolbar (fallback) {
  if (typeof window === 'undefined') return fallback

  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (value === 'true') return true
    if (value === 'false') return false
  } catch {}

  return fallback
}

function saveShowToolbar (value) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
  } catch {}
}

export function ToolbarContextProvider ({ topLevel, children }) {
  const [toolbarState, setToolbarState] = useState(() => ({
    ...INITIAL_STATE,
    showToolbar: getInitialShowToolbar(!!topLevel)
  }))

  const batchUpdateToolbarState = useCallback((updates) => {
    if (Object.prototype.hasOwnProperty.call(updates, 'showToolbar')) {
      saveShowToolbar(updates.showToolbar)
    }
    setToolbarState((prev) => ({ ...prev, ...updates }))
  }, [])

  const updateToolbarState = useCallback((key, value) => {
    if (key === 'showToolbar') {
      saveShowToolbar(value)
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
