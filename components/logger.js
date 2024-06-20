import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useMe } from './me'
import fancyNames from '@/lib/fancy-names.json'

const generateFancyName = () => {
  // 100 adjectives * 100 nouns * 10000 = 100M possible names
  const pickRandom = (array) => array[Math.floor(Math.random() * array.length)]
  const adj = pickRandom(fancyNames.adjectives)
  const noun = pickRandom(fancyNames.nouns)
  const id = Math.floor(Math.random() * fancyNames.maxSuffix)
  return `${adj}-${noun}-${id}`
}

export function detectOS () {
  if (!window.navigator) return ''

  const userAgent = window.navigator.userAgent
  const platform = window.navigator.userAgentData?.platform || window.navigator.platform
  const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K']
  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE']
  const iosPlatforms = ['iPhone', 'iPad', 'iPod']
  let os = null

  if (macosPlatforms.indexOf(platform) !== -1) {
    os = 'Mac OS'
  } else if (iosPlatforms.indexOf(platform) !== -1) {
    os = 'iOS'
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    os = 'Windows'
  } else if (/Android/.test(userAgent)) {
    os = 'Android'
  } else if (/Linux/.test(platform)) {
    os = 'Linux'
  }

  return os
}

export const LoggerContext = createContext()

export const LoggerProvider = ({ children }) => {
  return (
    <ServiceWorkerLoggerProvider>
      {children}
    </ServiceWorkerLoggerProvider>
  )
}

const ServiceWorkerLoggerContext = createContext()

function ServiceWorkerLoggerProvider ({ children }) {
  const me = useMe()
  const [name, setName] = useState()
  const [os, setOS] = useState()

  useEffect(() => {
    let name = window.localStorage.getItem('fancy-name')
    if (!name) {
      name = generateFancyName()
      window.localStorage.setItem('fancy-name', name)
    }
    setName(name)
    setOS(detectOS())
  }, [])

  const log = useCallback(level => {
    return async (message, context) => {
      if (!me || !me.privates?.diagnostics) return
      const env = {
        userAgent: window.navigator.userAgent,
        // os may not be initialized yet
        os: os || detectOS()
      }
      const body = {
        level,
        env,
        // name may be undefined if it wasn't stored in local storage yet
        // we fallback to local storage since on page reloads, the name may wasn't fetched from local storage yet
        name: name || window.localStorage.getItem('fancy-name'),
        message,
        context
      }
      await fetch('/api/log', {
        method: 'post',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify(body)
      }).catch(console.error)
    }
  }, [me?.privates?.diagnostics, name, os])

  const logger = useMemo(() => ({
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    name
  }), [log, name])

  useEffect(() => {
    // for communication between app and service worker
    const channel = new MessageChannel()
    navigator?.serviceWorker?.controller?.postMessage({ action: 'MESSAGE_PORT' }, [channel.port2])
    channel.port1.onmessage = (event) => {
      const { message, level, context } = Object.assign({ level: 'info' }, event.data)
      logger[level](message, context)
    }
  }, [logger])

  return (
    <ServiceWorkerLoggerContext.Provider value={logger}>
      {children}
    </ServiceWorkerLoggerContext.Provider>
  )
}

export function useServiceWorkerLogger () {
  return useContext(ServiceWorkerLoggerContext)
}
