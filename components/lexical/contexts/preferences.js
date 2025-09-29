import { createContext, useContext, useMemo, useState, useCallback } from 'react'

const LexicalPreferencesContext = createContext({
  setOption: (name, value) => {},
  settings: {}
})

// TODO: preferences are local, and doesn't do anything yet, but we should make them user settings
export const LexicalPreferencesContextProvider = ({ children }) => {
  const [settings, setSettings] = useState({})

  const setOption = useCallback((name, value) => {
    setSettings((prev) => ({ ...prev, [name]: value }))
  }, [])

  const preferencesContextValue = useMemo(() => {
    return { setOption, settings }
  }, [setOption, settings])

  return (
    <LexicalPreferencesContext.Provider value={preferencesContextValue}>
      {children}
    </LexicalPreferencesContext.Provider>
  )
}

export const useLexicalPreferences = () => {
  return useContext(LexicalPreferencesContext)
}
