import { Button } from 'react-bootstrap'
import styles from '@/styles/logger.module.css'
import { useShowModal } from '@/components/modal'
import { ObstacleButtons } from '@/components/obstacle'
import { useToast } from '@/components/toast'
import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import { timeSince } from '@/lib/time'
import classNames from 'classnames'
import { useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import { FAST_POLL_INTERVAL_MS } from '@/lib/constants'
import { DELETE_WALLET_LOGS, WALLET_LOGS } from '@/wallets/client/fragments'
import { isTemplate } from '@/wallets/lib/util'
import { useWalletFormLogs } from '@/wallets/client/hooks/payment'

function mergeWalletLogs (logs, nextLogs, { append = false } = {}) {
  const merged = nextLogs.filter(log => !logs.some(existing => existing.id === log.id))
  return append ? [...logs, ...merged] : [...merged, ...logs]
}

function useRemoteWalletLogs ({ protocolId, debug, payInId, poll = true, enabled = true } = {}) {
  const [cursor, setCursor] = useState(null)
  const [logs, setLogs] = useState([])

  const logFilters = useMemo(() => ({ protocolId, payInId, debug }), [protocolId, payInId, debug])
  const [fetchLogs, { called, loading, error }] = useLazyQuery(WALLET_LOGS, {
    variables: logFilters,
    skip: !enabled,
    fetchPolicy: 'network-only'
  })

  const fetchWalletLogs = useCallback(async (variables = logFilters) => {
    const { data, error } = await fetchLogs({ variables })
    if (error) throw error
    return data.walletLogs
  }, [fetchLogs, logFilters])

  const pollLogs = useCallback(async () => {
    const { entries } = await fetchWalletLogs()
    setLogs(logs => mergeWalletLogs(logs, entries))
  }, [fetchWalletLogs])

  const loadMore = useCallback(async () => {
    const { entries, cursor: nextCursor } = await fetchWalletLogs({ ...logFilters, cursor })
    setLogs(logs => mergeWalletLogs(logs, entries, { append: true }))
    setCursor(nextCursor)
  }, [fetchWalletLogs, logFilters, cursor])

  useEffect(() => {
    setCursor(null)
    setLogs([])
  }, [enabled, logFilters])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    fetchWalletLogs()
      .then(({ entries, cursor }) => {
        if (cancelled) return
        setLogs(entries)
        setCursor(cursor)
      })
      .catch(error => {
        if (cancelled) return
        console.error('failed to fetch wallet logs:', error.message)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, fetchWalletLogs])

  useEffect(() => {
    if (!enabled || !poll) return

    const interval = setInterval(async () => {
      try {
        await pollLogs()
      } catch (error) {
        console.error('failed to fetch wallet logs:', error.message)
      }
    }, FAST_POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [enabled, poll, pollLogs])

  return useMemo(() => ({
    loading: enabled ? (!called ? true : loading) : false,
    logs,
    error,
    loadMore,
    hasMore: cursor !== null
  }), [enabled, called, loading, logs, error, loadMore, cursor])
}

function useDeleteWalletLogsMutation () {
  const client = useApolloClient()
  const [deleteWalletLogs] = useMutation(DELETE_WALLET_LOGS)

  return useCallback(async ({ protocolId, debug }) => {
    await deleteWalletLogs({
      variables: { protocolId, debug }
    })
    await client.refetchQueries({ include: [WALLET_LOGS] })
  }, [client, deleteWalletLogs])
}

function useWalletLogs ({ protocol, payInId, debug, poll = true } = {}) {
  const formLogs = useWalletFormLogs()
  const template = Boolean(protocol && isTemplate(protocol))
  const remoteLogs = useRemoteWalletLogs({
    protocolId: template ? undefined : protocol ? Number(protocol.id) : undefined,
    payInId,
    debug,
    poll,
    enabled: !template
  })

  return useMemo(() => {
    if (template) {
      const logs = formLogs?.logs ?? []
      return {
        logs,
        loading: false,
        error: null,
        loadMore: null,
        hasMore: false,
        canDelete: false,
        hideWhenEmpty: logs.length === 0,
        showFooter: false
      }
    }

    return {
      ...remoteLogs,
      canDelete: payInId === undefined,
      hideWhenEmpty: false,
      showFooter: true
    }
  }, [template, formLogs, remoteLogs, payInId])
}

export function WalletLogs ({ protocol, payInId, className, debug, poll = true }) {
  const walletLogs = useWalletLogs({ protocol, debug, payInId, poll })
  const deleteLogs = useDeleteWalletLogsModal(protocol, debug)
  const embedded = !!protocol || payInId !== undefined
  const transaction = payInId !== undefined && !protocol

  const onDelete = useCallback(() => {
    deleteLogs()
  }, [deleteLogs])

  // avoid unnecessary clutter when attaching new wallet
  if (walletLogs.hideWhenEmpty) return null

  return (
    <div className={className}>
      {walletLogs.canDelete && (
        <div className='d-flex w-100 align-items-center mb-3'>
          <span
            style={{ cursor: 'pointer' }}
            className='text-muted fw-bold nav-link ms-auto' onClick={onDelete}
          >clear logs
          </span>
        </div>
      )}
      <div className={classNames(styles.container, embedded && styles.embedded, transaction && styles.transaction)}>
        {walletLogs.logs.map((log, i) => (
          <LogMessage
            key={log.id ?? i}
            tag={protocol ? null : log.wallet?.name}
            level={log.level}
            message={log.message}
            context={log.context}
            payIn={log.payIn}
            ts={log.createdAt}
          />
        ))}
        {walletLogs.showFooter && (
          <WalletLogsFooter
            empty={walletLogs.logs.length === 0}
            loading={walletLogs.loading}
            hasMore={walletLogs.hasMore}
            loadMore={walletLogs.loadMore}
            transaction={transaction}
          />
        )}
      </div>
    </div>
  )
}

function useDeleteWalletLogsModal (protocol, debug) {
  const showModal = useShowModal()

  return useCallback(() => {
    showModal(onClose => <DeleteWalletLogsObstacle protocol={protocol} debug={debug} onClose={onClose} />)
  }, [showModal, protocol, debug])
}

function DeleteWalletLogsObstacle ({ protocol, onClose, debug }) {
  const toaster = useToast()
  const deleteWalletLogs = useDeleteWalletLogsMutation()

  const handleConfirm = useCallback(async () => {
    try {
      await deleteWalletLogs({
        protocolId: protocol ? Number(protocol.id) : undefined,
        debug
      })
      onClose()
      toaster.success('deleted wallet logs')
    } catch (err) {
      console.error('failed to delete wallet logs:', err)
      toaster.danger('failed to delete wallet logs')
    }
  }, [protocol, deleteWalletLogs, debug, onClose, toaster])

  const prompt = protocol
    ? 'Do you really want to delete all logs of this protocol?'
    : debug
      ? 'Do you really want to delete all debug logs?'
      : 'Do you really want to delete all logs?'

  return (
    <div className='text-center'>
      {prompt}
      <ObstacleButtons onClose={onClose} onConfirm={handleConfirm} confirmText='delete' />
    </div>
  )
}

function WalletLogsFooter ({ empty, loading, hasMore, loadMore, transaction }) {
  return (
    <>
      {loading
        ? <div className='w-100 text-center'>loading...</div>
        : empty && <div className='w-100 text-center'>{transaction ? 'no activity' : 'empty'}</div>}
      {hasMore
        ? <div className='w-100 text-center'><Button onClick={loadMore} size='sm' className='mt-3'>more</Button></div>
        : !transaction && <div className='w-100 text-center'>------ start of logs ------</div>}
    </>
  )
}

export function LogMessage ({ tag, level, message, context, ts }) {
  const [showContext, setShowContext] = useState(false)

  const filtered = context
    ? Object.keys(context)
      .filter(key => !['send', 'recv', 'status'].includes(key))
      .reduce((obj, key) => {
        obj[key] = context[key]
        return obj
      }, {})
    : {}

  const hasContext = context && Object.keys(filtered).length > 0
  const handleClick = () => {
    if (hasContext) { setShowContext(show => !show) }
  }
  const style = hasContext ? { cursor: 'pointer' } : { cursor: 'inherit' }

  return (
    <>
      <div className={styles.row} onClick={handleClick} style={style}>
        <TimeSince timestamp={ts} />
        <Level level={level} />
        {tag !== null && <Tag tag={tag?.toLowerCase() ?? 'system'} />}
        <Message message={message} />
        {hasContext && <Indicator show={showContext} />}
      </div>
      {hasContext && showContext && <Context context={filtered} />}
    </>
  )
}

function TimeSince ({ timestamp }) {
  const [time, setTime] = useState(timeSince(new Date(timestamp)))

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(timeSince(new Date(timestamp)))
    }, 1000)

    return () => clearInterval(timer)
  }, [timestamp])

  return <div className={styles.timestamp}>{time}</div>
}

function Tag ({ tag }) {
  return <div className={styles.tag}>{`[${tag}]`}</div>
}

function Level ({ level }) {
  let className
  switch (level.toLowerCase()) {
    case 'ok':
    case 'success':
      level = 'ok'
      className = 'text-success'; break
    case 'error':
      className = 'text-danger'; break
    case 'warning':
      level = 'warn'
      className = 'text-warning'; break
    case 'info':
      className = 'text-info'; break
    case 'debug':
    default:
      className = 'text-muted'; break
  }

  return <div className={classNames(styles.level, className)}>{level}</div>
}

function Message ({ message }) {
  return <div className={styles.message}>{message}</div>
}

function Indicator ({ show }) {
  return <div className={styles.indicator}>{show ? '-' : '+'}</div>
}

function Context ({ context }) {
  return (
    <div className={styles.context}>
      {Object.entries(context)
        .map(([key, value], i) => {
          return (
            <Fragment key={i}>
              <div>{key}:</div>
              <div className='text-break'>{value}</div>
            </Fragment>
          )
        })}
    </div>
  )
}
