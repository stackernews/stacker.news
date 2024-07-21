import LogMessage from './log-message'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import styles from '@/styles/log.module.css'
import { Button } from 'react-bootstrap'
import { useToast } from './toast'
import { useShowModal } from './modal'
import { WALLET_LOGS } from '@/fragments/wallet'
import { getWalletByType } from 'wallets'
import { gql, useMutation, useQuery } from '@apollo/client'
import { useMe } from './me'

export function WalletLogs ({ wallet, embedded }) {
  const logs = useWalletLogs(wallet)

  const tableRef = useRef()
  const showModal = useShowModal()

  return (
    <>
      <div className='d-flex w-100 align-items-center mb-3'>
        <span
          style={{ cursor: 'pointer' }}
          className='text-muted fw-bold nav-link ms-auto' onClick={() => {
            showModal(onClose => <DeleteWalletLogsObstacle wallet={wallet} onClose={onClose} />)
          }}
        >clear logs
        </span>
      </div>
      <div ref={tableRef} className={`${styles.logTable} ${embedded ? styles.embedded : ''}`}>
        {logs.length === 0 && <div className='w-100 text-center'>empty</div>}
        <table>
          <tbody>
            {logs.map((log, i) => <LogMessage key={i} {...log} />)}
          </tbody>
        </table>
        <div className='w-100 text-center'>------ start of logs ------</div>
      </div>
    </>
  )
}

function DeleteWalletLogsObstacle ({ wallet, onClose }) {
  const toaster = useToast()
  const { deleteLogs } = useWalletLogger(wallet)

  const prompt = `Do you really want to delete all ${wallet ? '' : 'wallet'} logs ${wallet ? 'of this wallet' : ''}?`
  return (
    <div className='text-center'>
      {prompt}
      <div className='d-flex justify-center align-items-center mt-3 mx-auto'>
        <span style={{ cursor: 'pointer' }} className='d-flex ms-auto text-muted fw-bold nav-link mx-3' onClick={onClose}>cancel</span>
        <Button
          className='d-flex me-auto mx-3' variant='danger'
          onClick={
            async () => {
              try {
                await deleteLogs()
                onClose()
                toaster.success('deleted wallet logs')
              } catch (err) {
                console.error(err)
                toaster.danger('failed to delete wallet logs')
              }
            }
          }
        >delete
        </Button>
      </div>
    </div>
  )
}

const WalletLoggerContext = createContext()
const WalletLogsContext = createContext()

const initIndexedDB = async (dbName, storeName) => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('IndexedDB not supported'))
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
    const request = window.indexedDB.open(dbName, 1)

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

export const WalletLoggerProvider = ({ children }) => {
  const me = useMe()
  const [logs, setLogs] = useState([])
  let dbName = 'app:storage'
  if (me) {
    dbName = `${dbName}:${me.id}`
  }
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
          .map(({ createdAt, wallet: walletType, ...log }) => {
            return {
              ts: +new Date(createdAt),
              wallet: tag(getWalletByType(walletType)),
              ...log
            }
          })
        return [...prevLogs, ...logs].sort((a, b) => b.ts - a.ts)
      })
    }
  })

  const [deleteServerWalletLogs] = useMutation(
    gql`
      mutation deleteWalletLogs($wallet: String) {
        deleteWalletLogs(wallet: $wallet)
      }
    `,
    {
      onCompleted: (_, { variables: { wallet: walletType } }) => {
        setLogs((logs) => {
          return logs.filter(l => walletType ? l.wallet !== getWalletByType(walletType).name : false)
        })
      }
    }
  )

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
    initIndexedDB(dbName, idbStoreName)
      .then(db => {
        idb.current = db

        // load all logs from IDB
        const tx = idb.current.transaction(idbStoreName, 'readonly')
        const store = tx.objectStore(idbStoreName)
        const index = store.index('ts')
        const request = index.getAll()
        request.onsuccess = () => {
          let logs = request.result
          setLogs((prevLogs) => {
            if (process.env.NODE_ENV !== 'production') {
              // in dev mode, useEffect runs twice, so we filter out duplicates here
              const existingIds = prevLogs.map(({ id }) => id)
              logs = logs.filter(({ id }) => !existingIds.includes(id))
            }
            // sort oldest first to keep same order as logs are appended
            return [...prevLogs, ...logs].sort((a, b) => b.ts - a.ts)
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
    const log = { wallet: tag(wallet), level, message, ts: +new Date() }
    saveLog(log)
    setLogs((prevLogs) => [log, ...prevLogs])
  }, [saveLog])

  const deleteLogs = useCallback(async (wallet) => {
    if (!wallet || wallet.walletType) {
      await deleteServerWalletLogs({ variables: { wallet: wallet?.walletType } })
    }
    if (!wallet || wallet.sendPayment) {
      const tx = idb.current.transaction(idbStoreName, 'readwrite')
      const objectStore = tx.objectStore(idbStoreName)
      const idx = objectStore.index('wallet_ts')
      const request = wallet ? idx.openCursor(window.IDBKeyRange.bound([tag(wallet), -Infinity], [tag(wallet), Infinity])) : idx.openCursor()
      request.onsuccess = function (event) {
        const cursor = event.target.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          // finished
          setLogs((logs) => logs.filter(l => wallet ? l.wallet !== tag(wallet) : false))
        }
      }
    }
  }, [me, setLogs])

  return (
    <WalletLogsContext.Provider value={logs}>
      <WalletLoggerContext.Provider value={{ appendLog, deleteLogs }}>
        {children}
      </WalletLoggerContext.Provider>
    </WalletLogsContext.Provider>
  )
}

export function useWalletLogger (wallet) {
  const { appendLog, deleteLogs: innerDeleteLogs } = useContext(WalletLoggerContext)

  const log = useCallback(level => message => {
    if (!wallet) {
      console.error('cannot log: no wallet set')
      return
    }

    // don't store logs for receiving wallets on client since logs are stored on server
    if (wallet.walletType) return

    // TODO:
    //   also send this to us if diagnostics was enabled,
    //   very similar to how the service worker logger works.
    appendLog(wallet, level, message)
    console[level !== 'error' ? 'info' : 'error'](`[${tag(wallet)}]`, message)
  }, [appendLog, wallet])

  const logger = useMemo(() => ({
    ok: (...message) => log('ok')(message.join(' ')),
    info: (...message) => log('info')(message.join(' ')),
    error: (...message) => log('error')(message.join(' '))
  }), [log, wallet?.name])

  const deleteLogs = useCallback((w) => innerDeleteLogs(w || wallet), [innerDeleteLogs, wallet])

  return { logger, deleteLogs }
}

function tag (wallet) {
  return wallet?.shortName || wallet?.name
}

export function useWalletLogs (wallet) {
  const logs = useContext(WalletLogsContext)
  return logs.filter(l => !wallet || l.wallet === tag(wallet))
}
