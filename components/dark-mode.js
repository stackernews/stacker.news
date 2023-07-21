import { useEffect, useState } from 'react'
import { getTheme, listenForThemeChange, setTheme } from '../public/dark'

export default function useDarkMode () {
  const [dark, setDark] = useState()

  useEffect(() => {
    const { user, dark } = getTheme()
    setDark({ user, dark })
    listenForThemeChange(setDark)
  }, [])

  return [dark?.dark, () => {
    setTheme(!dark.dark)
    setDark({ user: true, dark: !dark.dark })
  }]
}
