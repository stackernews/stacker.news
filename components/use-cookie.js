import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as cookie from 'cookie'
import { cookieOptions } from '@/lib/auth'

const CookiesContext = createContext({})

/**
 * Provides cookies for SSR hydration.
 * IMPORTANT: Only pass non-httpOnly cookies here. Passing httpOnly cookies
 * would expose them to JavaScript and defeat their security purpose.
 */
export function CookiesProvider ({ ssrPublicCookies = {}, children }) {
  return (
    <CookiesContext.Provider value={ssrPublicCookies}>
      {children}
    </CookiesContext.Provider>
  )
}

export default function useCookie (name) {
  const ssrCookies = useContext(CookiesContext)
  const [value, setValue] = useState(ssrCookies[name] ?? null)

  useEffect(() => {
    const checkCookie = () => {
      const oldValue = value
      const newValue = cookie.parse(document.cookie)[name]
      if (oldValue !== newValue) setValue(newValue)
    }
    checkCookie()
    // there's no way to listen for cookie changes that is supported by all browsers
    // so we poll to detect changes
    // see https://developer.mozilla.org/en-US/docs/Web/API/Cookie_Store_API
    const interval = setInterval(checkCookie, 1000)
    return () => clearInterval(interval)
  }, [name, value])

  const set = useCallback((value, options = {}) => {
    document.cookie = cookie.serialize(name, value, { ...cookieOptions(), ...options })
    setValue(value)
  }, [name])

  const remove = useCallback(() => {
    // path must match the SET (cookieOptions defaults path to '/'); without it
    // the browser uses the current URL's directory and the clear silently misses.
    document.cookie = cookie.serialize(name, '', cookieOptions({ httpOnly: false, maxAge: 0 }))
    setValue(null)
  }, [name])

  return [value, set, remove]
}
