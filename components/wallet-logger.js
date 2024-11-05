import LogMessage from './log-message'
import { useCallback, useMemo, useState } from 'react'
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
import useInterval from './use-interval'

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

  const appendLog = useCallback(async (wallet, level, message, context) => {
    const log = { wallet: tag(wallet), level, message, ts: +new Date(), context }
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

  const log = useCallback(level => (message, context) => {
    if (!wallet) {
      // console.error('cannot log: no wallet set')
      return
    }

    appendLog(wallet, level, message, context)
    console[level !== 'error' ? 'info' : 'error'](`[${tag(wallet)}]`, message)
  }, [appendLog, wallet])

  const logger = useMemo(() => ({
    ok: (message, context) => log('ok')(message, context),
    info: (message, context) => log('info')(message, context),
    error: (message, context) => log('error')(message, context)
  }), [log])

  return { logger, deleteLogs }
}

function tag (walletDef) {
  return walletDef.shortName || walletDef.name
}

export function useWalletLogs (wallet, initialPage = 1, logsPerPage = 10) {
  const [logs, _setLogs] = useState([])
  const [page, setPage] = useState(initialPage)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)

  const { getPage, error, notSupported } = useWalletLogDB()
  const [getWalletLogs] = useLazyQuery(WALLET_LOGS, SSR ? {} : { fetchPolicy: 'cache-and-network' })

  const setLogs = useCallback((action) => {
    _setLogs(action)
    // action can be a React state dispatch function
    const newLogs = typeof action === 'function' ? action(logs) : action
    // make sure 'more' button is removed if logs were deleted
    if (newLogs.length === 0) setHasMore(false)
  }, [logs, _setLogs, setHasMore])

  const loadLogsPage = useCallback(async (page, pageSize, walletDef, variables = {}) => {
    try {
      let result = { data: [], hasMore: false }
      if (notSupported) {
        console.log('cannot get client wallet logs: indexeddb not supported')
      } else {
        const indexName = walletDef ? 'wallet_ts' : 'ts'
        const query = walletDef ? window.IDBKeyRange.bound([tag(walletDef), -Infinity], [tag(walletDef), Infinity]) : null

        result = await getPage(page, pageSize, indexName, query, 'prev')
        // if given wallet has no walletType it means logs are only stored in local IDB
        if (walletDef && !walletDef.walletType) {
          return result
        }
      }

      const oldestTs = result?.data[result.data.length - 1]?.ts // start of local logs
      const newestTs = result?.data[0]?.ts // end of local logs

      let from
      if (variables?.from !== undefined) {
        from = variables.from
      } else if (oldestTs && result.hasMore) {
        // fetch all missing, interwined server logs since start of local logs
        from = String(oldestTs)
      } else {
        from = null
      }

      let to
      if (variables?.to !== undefined) {
        to = variables.to
      } else if (newestTs && cursor) {
        // fetch next old page of server logs
        // ( if cursor is available, we will use decoded time of cursor )
        to = String(newestTs)
      } else {
        to = null
      }

      const { data } = await getWalletLogs({
        variables: {
          type: walletDef?.walletType,
          from,
          to,
          cursor,
          ...variables
        }
      })

      const newLogs = data.walletLogs.entries.map(({ createdAt, wallet: walletType, ...log }) => ({
        ts: +new Date(createdAt),
        wallet: tag(getWalletByType(walletType)),
        ...log
      }))
      const combinedLogs = uniqueSort([...result.data, ...newLogs])

      setCursor(data.walletLogs.cursor)
      return {
        ...result,
        data: combinedLogs,
        hasMore: result.hasMore || !!data.walletLogs.cursor
      }
    } catch (error) {
      console.error('Error loading logs from IndexedDB:', error)
      return { data: [], hasMore: false }
    }
  }, [getPage, setCursor, cursor, notSupported])

  if (error) {
    console.error('IndexedDB error:', error)
  }

  const loadMore = useCallback(async () => {
    if (hasMore) {
      setLoading(true)
      const result = await loadLogsPage(page + 1, logsPerPage, wallet?.def)
      _setLogs(prevLogs => [...prevLogs, ...result.data])
      setHasMore(result.hasMore)
      setPage(prevPage => prevPage + 1)
      setLoading(false)
    }
  }, [loadLogsPage, page, logsPerPage, wallet?.def, hasMore])

  const loadNew = useCallback(async () => {
    const newestTs = logs[0]?.ts
    const variables = { from: newestTs?.toString(), to: null }
    const result = await loadLogsPage(1, logsPerPage, wallet?.def, variables)
    setLoading(false)
    _setLogs(prevLogs => uniqueSort([...result.data, ...prevLogs]))
    if (!newestTs) {
      // we only want to update the more button if we didn't fetch new logs since it is about old logs.
      // we didn't fetch new logs if this is our first fetch (no newest timestamp available)
      setHasMore(result.hasMore)
    }
  }, [logs, wallet?.def, loadLogsPage])

  useInterval(() => {
    loadNew().catch(console.error)
  }, 1_000, [loadNew])

  return { logs, hasMore: !loading && hasMore, loadMore, setLogs, loading }
}

function uniqueSort (logs) {
  return Array.from(new Set(logs.map(JSON.stringify))).map(JSON.parse).sort((a, b) => b.ts - a.ts)
}
