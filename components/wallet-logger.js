import LogMessage from './log-message'
import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from '@/styles/log.module.css'
import { Button } from 'react-bootstrap'
import { useToast } from './toast'
import { useShowModal } from './modal'
import { WALLET_LOGS } from '@/fragments/wallet'
import { getWalletByType } from '@/wallets/common'
import { gql, useLazyQuery, useMutation } from '@apollo/client'
import { useMe } from './me'
import useIndexedDB, { getDbName } from './use-indexeddb'
import { SSR } from '@/lib/constants'

export function WalletLogs ({ wallet, embedded }) {
  const { logs, setLogs, hasMore, loadMore, loading } = useWalletLogs(wallet)

  const showModal = useShowModal()

  return (
    <>
      <div className='d-flex w-100 align-items-center mb-3'>
        <span
          style={{ cursor: 'pointer' }}
          className='text-muted fw-bold nav-link ms-auto' onClick={() => {
            showModal(onClose => <DeleteWalletLogsObstacle wallet={wallet} setLogs={setLogs} onClose={onClose} />)
          }}
        >clear logs
        </span>
      </div>
      <div className={`${styles.logTable} ${embedded ? styles.embedded : ''}`}>
        <table>
          <tbody>
            {logs.map((log, i) => (
              <LogMessage
                key={i}
                showWallet={!wallet}
                {...log}
              />
            ))}
          </tbody>
        </table>
        {loading
          ? <div className='w-100 text-center'>loading...</div>
          : logs.length === 0 && <div className='w-100 text-center'>empty</div>}
        {hasMore
          ? <div className='w-100 text-center'><Button onClick={loadMore} size='sm' className='mt-3'>more</Button></div>
          : <div className='w-100 text-center'>------ start of logs ------</div>}
      </div>
    </>
  )
}

function DeleteWalletLogsObstacle ({ wallet, setLogs, onClose }) {
  const { deleteLogs } = useWalletLogger(wallet, setLogs)
  const toaster = useToast()

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
                await deleteLogs(wallet)
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

const INDICES = [
  { name: 'ts', keyPath: 'ts' },
  { name: 'wallet_ts', keyPath: ['wallet', 'ts'] }
]

function getWalletLogDbName (userId) {
  return getDbName(userId)
}

function useWalletLogDB () {
  const { me } = useMe()
  // memoize the idb config to avoid re-creating it on every render
  const idbConfig = useMemo(() =>
    ({ dbName: getWalletLogDbName(me?.id), storeName: 'wallet_logs', indices: INDICES }), [me?.id])
  const { add, getPage, clear, error, notSupported } = useIndexedDB(idbConfig)

  return { add, getPage, clear, error, notSupported }
}

export function useWalletLogger (wallet, setLogs) {
  const { add, clear, notSupported } = useWalletLogDB()

  const appendLog = useCallback(async (wallet, level, message) => {
    const log = { wallet: tag(wallet), level, message, ts: +new Date() }
    try {
      if (notSupported) {
        console.log('cannot persist wallet log: indexeddb not supported')
      } else {
        await add(log)
      }
      setLogs?.(prevLogs => [log, ...prevLogs])
    } catch (error) {
      console.error('Failed to append wallet log:', error)
    }
  }, [add, notSupported])

  const [deleteServerWalletLogs] = useMutation(
    gql`
      mutation deleteWalletLogs($wallet: String) {
        deleteWalletLogs(wallet: $wallet)
      }
    `,
    {
      onCompleted: (_, { variables: { wallet: walletType } }) => {
        setLogs?.(logs => logs.filter(l => walletType ? l.wallet !== getWalletByType(walletType).name : false))
      }
    }
  )

  const deleteLogs = useCallback(async (wallet, options) => {
    if ((!wallet || wallet.def.walletType) && !options?.clientOnly) {
      await deleteServerWalletLogs({ variables: { wallet: wallet?.def.walletType } })
    }
    if (!wallet || wallet.sendPayment) {
      try {
        const walletTag = wallet ? tag(wallet) : null
        if (notSupported) {
          console.log('cannot clear wallet logs: indexeddb not supported')
        } else {
          await clear('wallet_ts', walletTag ? window.IDBKeyRange.bound([walletTag, 0], [walletTag, Infinity]) : null)
        }
        setLogs?.(logs => logs.filter(l => wallet ? l.wallet !== tag(wallet) : false))
      } catch (e) {
        console.error('failed to delete logs', e)
      }
    }
  }, [clear, deleteServerWalletLogs, setLogs, notSupported])

  const log = useCallback(level => message => {
    if (!wallet) {
      // console.error('cannot log: no wallet set')
      return
    }

    appendLog(wallet, level, message)
    console[level !== 'error' ? 'info' : 'error'](`[${tag(wallet)}]`, message)
  }, [appendLog, wallet])

  const logger = useMemo(() => ({
    ok: (...message) => log('ok')(message.join(' ')),
    info: (...message) => log('info')(message.join(' ')),
    error: (...message) => log('error')(message.join(' '))
  }), [log])

  return { logger, deleteLogs }
}

function tag (walletDef) {
  return walletDef.shortName || walletDef.name
}

export function useWalletLogs (wallet, initialPage = 1, logsPerPage = 10) {
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(initialPage)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)

  const { getPage, error, notSupported } = useWalletLogDB()
  const [getWalletLogs] = useLazyQuery(WALLET_LOGS, SSR ? {} : { fetchPolicy: 'cache-and-network' })

  const loadLogsPage = useCallback(async (page, pageSize, walletDef) => {
    try {
      let result = { data: [], hasMore: false }
      if (notSupported) {
        console.log('cannot get client wallet logs: indexeddb not supported')
      } else {
        const indexName = walletDef ? 'wallet_ts' : 'ts'
        const query = walletDef ? window.IDBKeyRange.bound([tag(walletDef), -Infinity], [tag(walletDef), Infinity]) : null

        result = await getPage(page, pageSize, indexName, query, 'prev')
        // no walletType means we're using the local IDB
        if (!walletDef?.walletType) {
          return result
        }
      }
      const { data } = await getWalletLogs({
        variables: {
          type: walletDef.walletType,
          // if it client logs has more, page based on it's range
          from: result?.data[result.data.length - 1]?.ts && result.hasMore ? String(result.data[result.data.length - 1].ts) : null,
          // if we have a cursor (this isn't the first page), page based on it's range
          to: result?.data[0]?.ts && cursor ? String(result.data[0].ts) : null,
          cursor
        }
      })

      const newLogs = data.walletLogs.entries.map(({ createdAt, wallet: walletType, ...log }) => ({
        ts: +new Date(createdAt),
        wallet: tag(getWalletByType(walletType)),
        ...log
      }))
      const combinedLogs = Array.from(new Set([...result.data, ...newLogs].map(JSON.stringify))).map(JSON.parse).sort((a, b) => b.ts - a.ts)

      setCursor(data.walletLogs.cursor)
      return { ...result, data: combinedLogs, hasMore: result.hasMore || !!data.walletLogs.cursor }
    } catch (error) {
      console.error('Error loading logs from IndexedDB:', error)
      return { data: [], total: 0, hasMore: false }
    }
  }, [getPage, setCursor, cursor, notSupported])

  if (error) {
    console.error('IndexedDB error:', error)
  }

  const loadMore = useCallback(async () => {
    if (hasMore) {
      setLoading(true)
      const result = await loadLogsPage(page + 1, logsPerPage, wallet?.def)
      setLogs(prevLogs => [...prevLogs, ...result.data])
      setHasMore(result.hasMore)
      setTotal(result.total)
      setPage(prevPage => prevPage + 1)
      setLoading(false)
    }
  }, [loadLogsPage, page, logsPerPage, wallet?.def, hasMore])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const result = await loadLogsPage(1, logsPerPage, wallet?.def)
    setLogs(result.data)
    setHasMore(result.hasMore)
    setTotal(result.total)
    setPage(1)
    setLoading(false)
  }, [wallet?.def, loadLogsPage])

  useEffect(() => {
    loadLogs()
  }, [wallet?.def])

  return { logs, hasMore, total, loadMore, loadLogs, setLogs, loading }
}
