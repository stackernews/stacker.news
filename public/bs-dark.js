const handleThemeChange = (dark) => {
  const root = window.document.documentElement
  root.setAttribute('data-bs-theme', dark ? 'dark' : 'light')
}

const STORAGE_KEY = 'darkMode'
const PREFER_DARK_QUERY = '(prefers-color-scheme: dark)'

export const getTheme = () => {
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

export const setTheme = (dark) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dark))
  handleThemeChange(dark)
}

export const listenForThemeChange = (onChange) => {
  const mql = window.matchMedia(PREFER_DARK_QUERY)
  mql.onchange = mql => {
    const { user, dark } = getTheme()
    if (!user) {
      handleThemeChange(dark)
      onChange({ user, dark })
    }
  }
  window.onstorage = e => {
    if (e.key === STORAGE_KEY) {
      const dark = JSON.parse(e.newValue)
      setTheme(dark)
      onChange({ user: true, dark })
    }
  }
}

if (typeof window !== 'undefined') {
  (function () {
    const { dark } = getTheme()
    handleThemeChange(dark)
  })()
}
