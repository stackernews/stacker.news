import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'

// remember the toolbar visibility preference across editors and sessions (#2858)
const TOOLBAR_STORAGE_KEY = 'editorToolbar'

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

  // restore the toolbar visibility preference after mount so SSR markup
  // (default visibility) stays consistent during hydration
  useEffect(() => {
    const stored = window.localStorage.getItem(TOOLBAR_STORAGE_KEY)
    if (stored === 'shown' || stored === 'hidden') {
      setToolbarState((prev) => ({ ...prev, showToolbar: stored === 'shown' }))
    }
  }, [])

  const batchUpdateToolbarState = useCallback((updates) => {
    setToolbarState((prev) => ({ ...prev, ...updates }))
  }, [])

  const updateToolbarState = useCallback((key, value) => {
    if (key === 'showToolbar') {
      window.localStorage.setItem(TOOLBAR_STORAGE_KEY, value ? 'shown' : 'hidden')
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
