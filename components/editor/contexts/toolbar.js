import { createContext, useContext, useMemo, useState, useCallback } from 'react'

const INITIAL_STATE = {
  previewMode: false
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
