import { useMutation, useLazyQuery } from '@apollo/client'
import { ADD_WALLET_LOG, WALLET_LOGS, DELETE_WALLET_LOGS } from '@/wallets/client/fragments'
import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react'
import { useShowModal } from '@/components/modal'
import { ObstacleButtons } from '@/components/obstacle'
import { useToast } from '@/components/toast'
import { FAST_POLL_INTERVAL_MS } from '@/lib/constants'
import { isTemplate } from '@/wallets/lib/util'
import { useDiagnostics } from '@/wallets/client/hooks/diagnostics'

const TemplateLogsContext = createContext({})

export function TemplateLogsProvider ({ children }) {
  const [templateLogs, setTemplateLogs] = useState([])

  const addTemplateLog = useCallback(({ level, message }) => {
    // TODO(wallet-v2): Date.now() might return the same value for two logs
    //   use window.performance.now() instead?
    setTemplateLogs(prev => [{ id: Date.now(), level, message, createdAt: new Date() }, ...prev])
  }, [])

  const clearTemplateLogs = useCallback(() => {
    setTemplateLogs([])
  }, [])

  const value = useMemo(() => ({
    templateLogs,
    addTemplateLog,
    clearTemplateLogs
  }), [templateLogs, addTemplateLog, clearTemplateLogs])

  return (
    <TemplateLogsContext.Provider value={value}>
      {children}
    </TemplateLogsContext.Provider>
  )
}

export function useWalletLoggerFactory () {
  const { addTemplateLog } = useContext(TemplateLogsContext)
  const [addWalletLog] = useMutation(ADD_WALLET_LOG)
  const [diagnostics] = useDiagnostics()

  const log = useCallback(({ protocol, level, message, payInId, updateStatus = false }) => {
    console[mapLevelToConsole(level)](`[${protocol ? protocol.name : 'system'}] ${message}`)

    if (protocol && isTemplate(protocol)) {
      // this is a template, so there's no protocol yet to which we could attach logs in the db
      addTemplateLog?.({ level, message })
      return
    }

    return addWalletLog({ variables: { protocolId: protocol ? Number(protocol.id) : null, level, message, timestamp: new Date(), payInId, updateStatus } })
      .catch(err => {
        console.error('error adding wallet log:', err)
      })
  }, [addWalletLog, addTemplateLog])

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
        log({ protocol, level: 'WARN', message, payInId, updateStatus: context.updateStatus })
      },
      debug: (message, context = {}) => {
        if (!diagnostics) return
        log({ protocol, level: 'DEBUG', message, payInId, updateStatus: context.updateStatus })
      }
    }
  }, [log, diagnostics])
}

export function useWalletLogger (protocol) {
  const loggerFactory = useWalletLoggerFactory()
  return useMemo(() => loggerFactory(protocol), [loggerFactory, protocol])
}

export function useWalletLogs (protocol, debug, payInId, { poll = true, pollInterval = FAST_POLL_INTERVAL_MS } = {}) {
  const { templateLogs, clearTemplateLogs } = useContext(TemplateLogsContext)

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

  useEffect(() => {
    setCursor(null)
    setLogs([])
  }, [logFilters])

  useEffect(() => {
    if (noFetch) return

    let active = true
    const syncLogs = async () => {
      const { data, error } = await fetchLogs({ variables: logFilters })
      if (!active) return
      if (error) {
        console.error('failed to fetch wallet logs:', error.message)
        return
      }
      const { entries, cursor } = data.walletLogs
      setLogs(entries)
      setCursor(cursor)
    }

    syncLogs()
    return () => { active = false }
  }, [fetchLogs, logFilters, noFetch])

  useEffect(() => {
    if (noFetch || !poll) return

    const interval = setInterval(async () => {
      const { data, error } = await fetchLogs({ variables: logFilters })
      if (error) {
        console.error('failed to fetch wallet logs:', error.message)
        return
      }
      const { entries: updatedLogs } = data.walletLogs
      setLogs(logs => [...updatedLogs.filter(log => !logs.some(l => l.id === log.id)), ...logs])
    }, pollInterval)

    return () => clearInterval(interval)
  }, [fetchLogs, logFilters, noFetch, poll, pollInterval])

  const loadMore = useCallback(async () => {
    const { data } = await fetchLogs({ variables: { ...logFilters, cursor } })
    const { entries: cursorLogs, cursor: newCursor } = data.walletLogs
    setLogs(logs => [...logs, ...cursorLogs.filter(log => !logs.some(l => l.id === log.id))])
    setCursor(newCursor)
  }, [fetchLogs, cursor, logFilters])

  const clearLogs = useCallback(() => {
    setLogs([])
    clearTemplateLogs?.()
    setCursor(null)
  }, [clearTemplateLogs])

  return useMemo(() => {
    return {
      loading: noFetch ? false : (!called ? true : loading),
      logs: noFetch ? templateLogs : logs,
      error,
      loadMore,
      hasMore: cursor !== null,
      clearLogs
    }
  }, [loading, noFetch, called, templateLogs, logs, error, loadMore, cursor, clearLogs])
}

function mapLevelToConsole (level) {
  switch (level) {
    case 'OK':
    case 'INFO':
      return 'info'
    case 'ERROR':
      return 'error'
    case 'WARN':
      return 'warn'
    default:
      return 'log'
  }
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
