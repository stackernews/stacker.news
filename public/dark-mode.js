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

if (typeof window !== 'undefined') {
  (function () {
    const { dark } = getTheme()
    handleThemeChange(dark)
  })()
}
