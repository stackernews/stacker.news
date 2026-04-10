import { useMutation, useLazyQuery } from '@apollo/client'
import { WALLET_LOGS, DELETE_WALLET_LOGS } from '@/wallets/client/fragments'
import { useCallback, useMemo, useState, useEffect } from 'react'
import { useShowModal } from '@/components/modal'
import { ObstacleButtons } from '@/components/obstacle'
import { useToast } from '@/components/toast'
import { FAST_POLL_INTERVAL_MS } from '@/lib/constants'
import { isTemplate } from '@/wallets/lib/util'
import { useWalletFormLogs } from './payment'

export function useWalletLogs (protocol, debug, payInId, { poll = true, pollInterval = FAST_POLL_INTERVAL_MS } = {}) {
  const formLogs = useWalletFormLogs()
  const localLogs = formLogs?.logs ?? []
  const clearLocalLogs = formLogs?.clearLogs

  const [cursor, setCursor] = useState(null)
  const [logs, setLogs] = useState([])

  // if no protocol was given, we want to fetch all logs
  const protocolId = protocol ? Number(protocol.id) : undefined
  const logFilters = useMemo(() => ({ protocolId, payInId, debug }), [protocolId, payInId, debug])

  // if we're configuring a protocol template, there are no logs to fetch
  const noFetch = protocol && isTemplate(protocol)
  const [fetchLogs, { called, loading, error }] = useLazyQuery(WALLET_LOGS, {
    variables: logFilters,
    skip: noFetch,
    fetchPolicy: 'network-only'
  })

  const loadLogs = useCallback(async ({ cursor, mode } = {}) => {
    const { data, error } = await fetchLogs({
      variables: cursor ? { ...logFilters, cursor } : logFilters
    })
    if (error) {
      console.error('failed to fetch wallet logs:', error.message)
      return
    }

    const { entries, cursor: nextCursor } = data.walletLogs
    if (mode === 'append') {
      setLogs(logs => [...logs, ...entries.filter(log => !logs.some(existing => existing.id === log.id))])
      setCursor(nextCursor)
      return
    }
    if (mode === 'prepend') {
      setLogs(logs => [...entries.filter(log => !logs.some(existing => existing.id === log.id)), ...logs])
      return
    }

    setLogs(entries)
    setCursor(nextCursor)
  }, [fetchLogs, logFilters])

  useEffect(() => {
    if (noFetch) return

    setCursor(null)
    setLogs([])
    loadLogs()

    if (!poll) return

    const interval = setInterval(() => {
      loadLogs({ mode: 'prepend' })
    }, pollInterval)

    return () => clearInterval(interval)
  }, [loadLogs, noFetch, poll, pollInterval])

  const loadMore = useCallback(async () => {
    await loadLogs({ cursor, mode: 'append' })
  }, [loadLogs, cursor])

  const clearLogs = useCallback(() => {
    setLogs([])
    clearLocalLogs?.()
    setCursor(null)
  }, [clearLocalLogs])

  return useMemo(() => {
    return {
      loading: noFetch ? false : (!called ? true : loading),
      logs: noFetch ? localLogs : logs,
      error,
      loadMore,
      hasMore: cursor !== null,
      clearLogs
    }
  }, [loading, noFetch, called, localLogs, logs, error, loadMore, cursor, clearLogs])
}

export function useDeleteWalletLogs (protocol, debug) {
  const showModal = useShowModal()

  return useCallback((callbacks = {}) => {
    showModal(onClose => <DeleteWalletLogsObstacle protocol={protocol} debug={debug} onClose={onClose} {...callbacks} />)
  }, [showModal, protocol, debug])
}

function DeleteWalletLogsObstacle ({ protocol, onClose, onSuccess, debug }) {
  const toaster = useToast()
  const [deleteWalletLogs] = useMutation(DELETE_WALLET_LOGS)

  const handleConfirm = useCallback(async () => {
    try {
      // there are no logs to delete on the server if protocol is a template
      if (protocol && !isTemplate(protocol)) {
        await deleteWalletLogs({
          variables: { protocolId: protocol ? Number(protocol.id) : undefined, debug }
        })
      }
      onClose()
      onSuccess?.()
      toaster.success('deleted wallet logs')
    } catch (err) {
      console.error('failed to delete wallet logs:', err)
      toaster.danger('failed to delete wallet logs')
    }
  }, [protocol, deleteWalletLogs, debug, onClose, onSuccess, toaster])

  let prompt = debug ? 'Do you really want to delete all debug logs?' : 'Do you really want to delete all logs?'
  if (protocol) {
    prompt = 'Do you really want to delete all logs of this protocol?'
  }

  return (
    <div className='text-center'>
      {prompt}
      <ObstacleButtons onClose={onClose} onConfirm={handleConfirm} confirmText='delete' />
    </div>
  )
}
