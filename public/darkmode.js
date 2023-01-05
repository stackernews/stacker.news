// Insert this script in your index.html right after the <body> tag.
// This will help to prevent a flash if dark mode is the default.
const COLORS = {
  light: {
    body: '#f5f5f5',
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
    brandColor: 'var(--primary)',
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

if (typeof window !== 'undefined') {
  (function () {
    // Change these if you use something different in your hook.
    const storageKey = 'darkMode'

    const preferDarkQuery = '(prefers-color-scheme: dark)'
    const mql = window.matchMedia(preferDarkQuery)
    const supportsColorSchemeQuery = mql.media === preferDarkQuery
    let localStorageTheme = null
    try {
      localStorageTheme = localStorage.getItem(storageKey)
    } catch (err) {}
    const localStorageExists = localStorageTheme !== null
    if (localStorageExists) {
      localStorageTheme = JSON.parse(localStorageTheme)
    }

    // Determine the source of truth
    if (localStorageExists) {
    // source of truth from localStorage
      handleThemeChange(localStorageTheme)
    } else if (supportsColorSchemeQuery) {
    // source of truth from system
      handleThemeChange(mql.matches)
      localStorage.setItem(storageKey, mql.matches)
    }
  })()
}
