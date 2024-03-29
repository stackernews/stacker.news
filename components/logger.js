import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useMe } from './me'
import fancyNames from '@/lib/fancy-names.json'
import { datePivot } from '@/lib/time'

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
      <WalletLoggerProvider>
        {children}
      </WalletLoggerProvider>
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

const WalletLoggerContext = createContext()

const initIndexedDB = async (storeName) => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('IndexedDB not supported'))
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
    const request = window.indexedDB.open('app:storage', 1)

    let db
    request.onupgradeneeded = () => {
      db = request.result
      if (!db.objectStoreNames.contains(storeName)) {
        const objectStore = db.createObjectStore(storeName, { autoIncrement: true })
        objectStore.createIndex('ts', 'ts')
        objectStore.createIndex('wallet_ts', ['wallet', 'ts'])
      }
    }

    request.onsuccess = () => {
      // this gets called after onupgradeneeded finished
      db = request.result
      resolve(db)
    }

    request.onerror = () => {
      reject(new Error('failed to open IndexedDB'))
    }
  })
}

const WalletLoggerProvider = ({ children }) => {
  // TODO: persist logs in local storage
  // limit to last 24h?
  const [logs, setLogs] = useState([])
  const idbStoreName = 'wallet_logs'
  const idb = useRef()
  const logQueue = useRef([])

  const saveLog = useCallback((log) => {
    if (!idb.current) {
      // IDB may not be ready yet
      return logQueue.current.push(log)
    }
    const tx = idb.current.transaction(idbStoreName, 'readwrite')
    const request = tx.objectStore(idbStoreName).add(log)
    request.onerror = () => console.error('failed to save log:', log)
  }, [])

  useEffect(() => {
    initIndexedDB(idbStoreName)
      .then(db => {
        idb.current = db

        // load logs from IDB
        // -- open index sorted by timestamps
        const tx = idb.current.transaction(idbStoreName, 'readonly')
        const store = tx.objectStore(idbStoreName)
        const index = store.index('ts')
        // -- check if there is an open request for past logs else default to last 5m
        const sinces = logQueue.current?.filter(q => !!q.since).map(({ since }) => since).sort((a, b) => a - b)
        const sinceRounded = sinces?.[0] || +datePivot(new Date(), { minutes: -5 })
        const rounded = Math.floor(sinceRounded / 1e3) * 1e3
        // -- fetch rows from index
        const request = index.getAll(window.IDBKeyRange.lowerBound(rounded))
        request.onsuccess = () => {
          const logs = request.result
          setLogs((prevLogs) => {
            // sort oldest first to keep same order as logs are appended
            return [...prevLogs, ...logs].sort((a, b) => a.ts - b.ts)
          })
        }

        // flush queued logs to IDB
        logQueue.current.forEach(q => {
          const isLog = !!q.wallet
          if (isLog) saveLog(q)
        })

        logQueue.current = []
      })
      .catch(console.error)
    return () => idb.current?.close()
  }, [])

  const appendLog = useCallback((wallet, level, message) => {
    const log = { wallet, level, message, ts: +new Date() }
    saveLog(log)
    setLogs((prevLogs) => [...prevLogs, log])
  }, [setLogs, saveLog])

  const loadLogs = useCallback((lower) => {
    const upper = logs[0]?.ts || +new Date()

    if (!lower || !upper || lower >= upper) return

    if (!idb.current) {
      // queue loading logs until IDB is ready
      return logQueue.current.push({ since: lower })
    }

    const tx = idb.current.transaction(idbStoreName, 'readonly')
    const store = tx.objectStore(idbStoreName)
    const index = store.index('ts')
    const request = index.getAll(window.IDBKeyRange.bound(lower, upper, false, true))
    request.onsuccess = () => {
      const logs = request.result
      setLogs((prevLogs) => [...logs, ...prevLogs])
    }
  }, [logs, setLogs])

  return (
    <WalletLoggerContext.Provider value={{ logs, appendLog, loadLogs }}>
      {children}
    </WalletLoggerContext.Provider>
  )
}

export function useWalletLogger (wallet) {
  const { logs, appendLog: _appendLog, loadLogs } = useContext(WalletLoggerContext)

  const log = useCallback(level => message => {
    // TODO:
    //   also send this to us if diagnostics was enabled,
    //   very similar to how the service worker logger works.
    _appendLog(wallet, level, message)
    console[level !== 'error' ? 'info' : 'error'](`[${wallet}]`, message)
  }, [_appendLog, wallet])

  const logger = useMemo(() => ({
    ok: (...message) => log('ok')(message.join(' ')),
    info: (...message) => log('info')(message.join(' ')),
    error: (...message) => log('error')(message.join(' '))
  }), [log, wallet])

  return {
    loadLogs,
    logs: logs.filter(log => !wallet || log.wallet === wallet),
    ...logger
  }
}
