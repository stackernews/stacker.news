import { useCallback, useEffect, useState } from 'react'
import * as cookie from 'cookie'
import { cookieOptions } from '@/lib/auth'

export default function useCookie (name) {
  const [value, setValue] = useState(null)

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
  }, [value])

  const set = useCallback((value, options = {}) => {
    document.cookie = cookie.serialize(name, value, { ...cookieOptions(), ...options })
    setValue(value)
  }, [name])

  const remove = useCallback(() => {
    document.cookie = value.serialize(name, '', { expires: 0, maxAge: 0 })
    setValue(null)
  }, [name])

  return [value, set, remove]
}
