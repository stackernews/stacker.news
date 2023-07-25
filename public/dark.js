const COLORS = {
  light: {
    body: '#f5f5f7',
    color: '#212529',
    navbarVariant: 'light',
    navLink: 'rgba(0, 0, 0, 0.55)',
    navLinkFocus: 'rgba(0, 0, 0, 0.7)',
    navLinkActive: 'rgba(0, 0, 0, 0.9)',
    borderColor: '#ced4da',
    inputBg: '#ffffff',
    inputDisabledBg: '#e9ecef',
    dropdownItemColor: 'rgba(0, 0, 0, 0.7)',
    dropdownItemColorHover: 'rgba(0, 0, 0, 0.9)',
    commentBg: 'rgba(0, 0, 0, 0.03)',
    clickToContextColor: 'rgba(0, 0, 0, 0.07)',
    brandColor: 'rgba(0, 0, 0, 0.9)',
    grey: '#707070',
    link: '#007cbe',
    toolbarActive: 'rgba(0, 0, 0, 0.10)',
    toolbarHover: 'rgba(0, 0, 0, 0.20)',
    toolbar: '#ffffff',
    quoteBar: 'rgb(206, 208, 212)',
    quoteColor: 'rgb(101, 103, 107)',
    linkHover: '#004a72',
    linkVisited: '#537587'
  },
  dark: {
    body: '#000000',
    inputBg: '#000000',
    inputDisabledBg: '#000000',
    navLink: 'rgba(255, 255, 255, 0.55)',
    navLinkFocus: 'rgba(255, 255, 255, 0.75)',
    navLinkActive: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
    dropdownItemColor: 'rgba(255, 255, 255, 0.7)',
    dropdownItemColorHover: 'rgba(255, 255, 255, 0.9)',
    commentBg: 'rgba(255, 255, 255, 0.04)',
    clickToContextColor: 'rgba(255, 255, 255, 0.2)',
    color: '#f8f9fa',
    brandColor: 'var(--bs-primary)',
    grey: '#969696',
    link: '#2e99d1',
    toolbarActive: 'rgba(255, 255, 255, 0.10)',
    toolbarHover: 'rgba(255, 255, 255, 0.20)',
    toolbar: '#3e3f3f',
    quoteBar: 'rgb(158, 159, 163)',
    quoteColor: 'rgb(141, 144, 150)',
    linkHover: '#007cbe',
    linkVisited: '#56798E'
  }
}

const handleThemeChange = (dark) => {
  const root = window.document.documentElement
  const colors = COLORS[dark ? 'dark' : 'light']
  Object.entries(colors).forEach(([varName, value]) => {
    const cssVarName = `--theme-${varName}`
    root.style.setProperty(cssVarName, value)
  })
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
