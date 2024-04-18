import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useMe } from './me'
import fancyNames from '@/lib/fancy-names.json'
import { useQuery } from '@apollo/client'
import { WALLET_LOGS } from '@/fragments/wallet'

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
const WalletLogsContext = createContext()

const initIndexedDB = async (storeName) => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('IndexedDB not supported'))
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
    const request = window.indexedDB.open('app:storage', 1)

    let db
    request.onupgradeneeded = () => {
      // this only runs if version was changed during open
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

const renameWallet = (wallet) => {
  switch (wallet) {
    case 'walletLightningAddress':
    case 'LIGHTNING_ADDRESS':
      return 'lnAddr'
    case 'walletLND':
    case 'LND':
      return 'lnd'
    case 'walletCLN':
    case 'CLN':
      return 'cln'
  }
  return wallet
}

const WalletLoggerProvider = ({ children }) => {
  const [logs, setLogs] = useState([])
  const idbStoreName = 'wallet_logs'
  const idb = useRef()
  const logQueue = useRef([])

  useQuery(WALLET_LOGS, {
    fetchPolicy: 'network-only',
    // required to trigger onCompleted on refetches
    notifyOnNetworkStatusChange: true,
    onCompleted: ({ walletLogs }) => {
      setLogs((prevLogs) => {
        const existingIds = prevLogs.map(({ id }) => id)
        const logs = walletLogs
          .filter(({ id }) => !existingIds.includes(id))
          .map(({ createdAt, wallet, ...log }) => ({ ts: +new Date(createdAt), wallet: renameWallet(wallet), ...log }))
        return [...prevLogs, ...logs].sort((a, b) => a.ts - b.ts)
      })
    }
  })

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

        // load all logs from IDB
        const tx = idb.current.transaction(idbStoreName, 'readonly')
        const store = tx.objectStore(idbStoreName)
        const index = store.index('ts')
        const request = index.getAll()
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
  }, [saveLog])

  return (
    <WalletLogsContext.Provider value={logs}>
      <WalletLoggerContext.Provider value={appendLog}>
        {children}
      </WalletLoggerContext.Provider>
    </WalletLogsContext.Provider>
  )
}

export function useWalletLogger (wallet) {
  const appendLog = useContext(WalletLoggerContext)

  const log = useCallback(level => message => {
    // TODO:
    //   also send this to us if diagnostics was enabled,
    //   very similar to how the service worker logger works.
    appendLog(wallet, level, message)
    console[level !== 'error' ? 'info' : 'error'](`[${wallet}]`, message)
  }, [appendLog, wallet])

  const logger = useMemo(() => ({
    ok: (...message) => log('ok')(message.join(' ')),
    info: (...message) => log('info')(message.join(' ')),
    error: (...message) => log('error')(message.join(' '))
  }), [log, wallet])

  return logger
}

export function useWalletLogs (wallet) {
  const logs = useContext(WalletLogsContext)
  return logs.filter(l => !wallet || l.wallet === wallet)
}
