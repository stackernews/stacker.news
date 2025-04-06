import { useEffect, useState } from 'react'

const handleThemeChange = (dark) => {
  const root = window.document.documentElement
  root.setAttribute('data-bs-theme', dark ? 'dark' : 'light')
}

const STORAGE_KEY = 'darkMode'
const PREFER_DARK_QUERY = '(prefers-color-scheme: dark)'

const getTheme = () => {
  const mql = window.matchMedia(PREFER_DARK_QUERY)
  const supportsColorSchemeQuery = mql.media === PREFER_DARK_QUERY
  let localStorageTheme = null
  try {
    localStorageTheme = window.localStorage.getItem(STORAGE_KEY)
  } catch (err) {}
  const localStorageExists = localStorageTheme !== null
  if (localStorageExists) {
    localStorageTheme = JSON.parse(localStorageTheme)
  }

  if (localStorageExists) {
    return { user: true, dark: localStorageTheme }
  } else if (supportsColorSchemeQuery) {
    return { user: false, dark: mql.matches }
  }
}

const setTheme = (dark) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dark))
  handleThemeChange(dark)
}

const listenForThemeChange = (onChange) => {
  const mql = window.matchMedia(PREFER_DARK_QUERY)
  const onMqlChange = () => {
    const { user, dark } = getTheme()
    if (!user) {
      handleThemeChange(dark)
      onChange({ user, dark })
    }
  }
  mql.addEventListener('change', onMqlChange)

  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) {
      const dark = JSON.parse(e.newValue)
      setTheme(dark)
      onChange({ user: true, dark })
    }
  }
  window.addEventListener('storage', onStorage)

  const root = window.document.documentElement
  const observer = new window.MutationObserver(() => {
    const theme = root.getAttribute('data-bs-theme')
    onChange(dark => ({ ...dark, dark: theme === 'dark' }))
  })
  observer.observe(root, { attributes: true, attributeFilter: ['data-bs-theme'] })

  return () => {
    observer.disconnect()
    mql.removeEventListener('change', onMqlChange)
    window.removeEventListener('storage', onStorage)
  }
}

export default function useDarkMode () {
  const [dark, setDark] = useState()

  useEffect(() => {
    const { user, dark } = getTheme()
    setDark({ user, dark })
    return listenForThemeChange(setDark)
  }, [])

  return [dark?.dark, () => {
    setTheme(!dark.dark)
    setDark({ user: true, dark: !dark.dark })
  }]
}
