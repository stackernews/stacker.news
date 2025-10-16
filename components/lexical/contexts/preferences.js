import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'

export const DEFAULT_PREFERENCES = {
  startInMarkdown: true,
  showToolbar: false,
  showFloatingToolbar: true
}

const PREFERENCES_STORAGE_KEY = 'sn-lexical-preferences'

const LexicalPreferencesContext = createContext({
  setOption: (name, value) => {},
  prefs: DEFAULT_PREFERENCES
})

// TODO: preferences are local, but there's no way to set them.
export const LexicalPreferencesContextProvider = ({ children }) => {
  const [prefs, setPrefs] = useState(DEFAULT_PREFERENCES)

  // load preferences from local on mount
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
      if (stored) {
        const parsedPrefs = JSON.parse(stored)
        setPrefs(prev => ({ ...prev, ...parsedPrefs }))
      }
    } catch (error) {
      console.warn('failed to load preferences from local:', error)
    }
  }, [])

  const setOption = useCallback((name, value) => {
    setPrefs((prev) => {
      const newPrefs = { ...prev, [name]: value }
      // save to local
      try {
        window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(newPrefs))
      } catch (error) {
        console.warn('failed to save preferences in local:', error)
      }
      return newPrefs
    })
  }, [])

  const preferencesContextValue = useMemo(() => {
    return { setOption, prefs }
  }, [setOption, prefs])

  return (
    <LexicalPreferencesContext.Provider value={preferencesContextValue}>
      {children}
    </LexicalPreferencesContext.Provider>
  )
}

export const useLexicalPreferences = () => {
  return useContext(LexicalPreferencesContext)
}
