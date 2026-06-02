import { useLazyQuery, useMutation } from '@apollo/client/react'
import { isAbortError } from '@/lib/error'
import { ADD_WALLET_LOG, WALLET_LOGS, DELETE_WALLET_LOGS } from '@/wallets/client/fragments'
import { useCallback, useMemo, useState, useEffect } from 'react'
import { useShowModal } from '@/components/modal'
import { ObstacleButtons } from '@/components/obstacle'
import { useToast } from '@/components/toast'
import { WALLET_LOG_POLL_INTERVAL_MS } from '@/lib/constants'
import { isTemplate } from '@/wallets/lib/util'

export function useWalletLoggerFactory () {
  const [addWalletLog] = useMutation(ADD_WALLET_LOG)

  const log = useCallback(({ protocol, level, message, payInId, updateStatus = false }) => {
    console[mapLevelToConsole(level)](`[${protocol ? protocol.name : 'system'}] ${message}`)

    if (protocol && isTemplate(protocol)) return

    return addWalletLog({
      variables: {
        protocolId: protocol ? Number(protocol.id) : null,
        level,
        message,
        timestamp: new Date(),
        payInId,
        updateStatus
      }
    }).catch(err => {
      console.error('error adding wallet log:', err)
    })
  }, [addWalletLog])

  return useCallback((protocol, payIn) => {
    const payInId = payIn ? Number(payIn.id) : null
    return {
      ok: (message, context = {}) => {
        log({ protocol, level: 'OK', message, payInId, updateStatus: context.updateStatus })
      },
      info: (message, context = {}) => {
        log({ protocol, level: 'INFO', message, payInId, updateStatus: context.updateStatus })
      },
      error: (message, context = {}) => {
        log({ protocol, level: 'ERROR', message, payInId, updateStatus: context.updateStatus })
      },
      warn: (message, context = {}) => {
        log({ protocol, level: 'WARNING', message, payInId, updateStatus: context.updateStatus })
      }
    }
  }, [log])
}

export function useWalletLogger (protocol) {
  const loggerFactory = useWalletLoggerFactory()
  return useMemo(() => loggerFactory(protocol), [loggerFactory, protocol])
}

export function useWalletLogs (payInId, { poll = true, pollInterval = WALLET_LOG_POLL_INTERVAL_MS, walletId } = {}) {
  const [cursor, setCursor] = useState(null)
  const [logs, setLogs] = useState([])

  const logFilters = useMemo(() => ({ walletId, payInId }), [walletId, payInId])

  const [prevFilters, setPrevFilters] = useState(logFilters)
  if (prevFilters !== logFilters) {
    setPrevFilters(logFilters)
    setCursor(null)
    setLogs([])
  }

  const [fetchLogs, { called, loading, error }] = useLazyQuery(WALLET_LOGS, {
    fetchPolicy: 'network-only',
    errorPolicy: 'all'
  })

  const loadLogs = useCallback(async ({ cursor, mode } = {}) => {
    let data, error
    try {
      ({ data, error } = await fetchLogs({
        variables: cursor ? { ...logFilters, cursor } : logFilters
      }))
    } catch (err) {
      !isAbortError(err) && console.error(err)
      return
    }

    if (error) {
      console.error('failed to fetch wallet logs:', error.message)
      return
    }

    const { logs: fetchedLogs, cursor: nextCursor } = data.walletLogs
    if (mode === 'append') {
      setLogs(logs => [...logs, ...fetchedLogs.filter(log => !logs.some(existing => existing.id === log.id))])
      setCursor(nextCursor)
      return
    }
    if (mode === 'prepend') {
      setLogs(logs => [...fetchedLogs.filter(log => !logs.some(existing => existing.id === log.id)), ...logs])
      return
    }

    setLogs(fetchedLogs)
    setCursor(nextCursor)
  }, [fetchLogs, logFilters])

  useEffect(() => {
    loadLogs()

    if (!poll) return

    const interval = setInterval(() => {
      loadLogs({ mode: 'prepend' })
    }, pollInterval)

    return () => clearInterval(interval)
  }, [loadLogs, poll, pollInterval])

  const loadMore = useCallback(async () => {
    await loadLogs({ cursor, mode: 'append' })
  }, [loadLogs, cursor])

  const clearLogs = useCallback(() => {
    setLogs([])
    setCursor(null)
  }, [])

  return useMemo(() => {
    return {
      loading: !called ? true : loading,
      logs,
      error,
      loadMore,
      cursor,
      hasMore: cursor !== null,
      clearLogs
    }
  }, [loading, called, logs, error, loadMore, cursor, clearLogs])
}

export function useDeleteWalletLogs (wallet) {
  const showModal = useShowModal()

  return useCallback((callbacks = {}) => {
    showModal(onClose => <DeleteWalletLogsObstacle wallet={wallet} onClose={onClose} {...callbacks} />)
  }, [showModal, wallet])
}

function DeleteWalletLogsObstacle ({ wallet, onClose, onSuccess }) {
  const toaster = useToast()
  const [deleteWalletLogs] = useMutation(DELETE_WALLET_LOGS)

  const handleConfirm = useCallback(async () => {
    try {
      await deleteWalletLogs({
        variables: { walletId: wallet ? Number(wallet.id) : null }
      })
      onClose()
      onSuccess?.()
      toaster.success('deleted wallet logs')
    } catch (err) {
      console.error('failed to delete wallet logs:', err)
      toaster.danger('failed to delete wallet logs')
    }
  }, [wallet, deleteWalletLogs, onClose, onSuccess, toaster])

  let prompt = 'Do you really want to delete all logs?'
  if (wallet) {
    prompt = 'Do you really want to delete all logs of this wallet?'
  }

  return (
    <div className='text-center'>
      {prompt}
      <ObstacleButtons onClose={onClose} onConfirm={handleConfirm} confirmText='delete' />
    </div>
  )
}

function mapLevelToConsole (level) {
  switch (level) {
    case 'OK':
    case 'INFO':
      return 'info'
    case 'ERROR':
      return 'error'
    case 'WARN':
    case 'WARNING':
      return 'warn'
    default:
      return 'log'
  }
}
