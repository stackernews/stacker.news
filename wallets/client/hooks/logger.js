import { useMutation, useQuery } from '@apollo/client'
import { ADD_WALLET_LOG, WALLET_LOGS, DELETE_WALLET_LOGS } from '@/wallets/client/fragments'
import { useCallback, useMemo } from 'react'
import { Button } from 'react-bootstrap'
import { ModalClosedError, useShowModal } from '@/components/modal'
import { useToast } from '@/components/toast'
import { FAST_POLL_INTERVAL } from '@/lib/constants'
import { isTemplate } from '@/wallets/lib/util'

export function useWalletLoggerFactory () {
  const [addWalletLog] = useMutation(ADD_WALLET_LOG)

  const log = useCallback(({ protocol, level, message, invoiceId }) => {
    console[mapLevelToConsole(level)](`[${protocol.name}] ${message}`)
    addWalletLog({ variables: { protocolId: protocol.id, level, message, invoiceId, timestamp: new Date() } })
      .catch(err => {
        console.error('error adding wallet log:', err)
      })
  }, [addWalletLog])

  return useCallback((protocol, invoice) => {
    const invoiceId = invoice ? Number(invoice.id) : null
    return {
      ok: (message) => {
        log({ protocol, level: 'OK', message, invoiceId })
      },
      info: (message) => {
        log({ protocol, level: 'INFO', message, invoiceId })
      },
      error: (message) => {
        log({ protocol, level: 'ERROR', message, invoiceId })
      },
      warn: (message) => {
        log({ protocol, level: 'WARN', message, invoiceId })
      }
    }
  }, [log])
}

export function useWalletLogger (protocol) {
  const loggerFactory = useWalletLoggerFactory()
  return loggerFactory(protocol)
}

export function useWalletLogs (protocol) {
  const { data, loading, error, refetch } = useQuery(WALLET_LOGS, {
    variables: {
      // if no protocol was given, we want to fetch all logs
      protocolId: protocol ? Number(protocol.id) : undefined
    },
    // if we're configuring a protocol template, there are no logs to fetch
    skip: protocol && isTemplate(protocol),
    pollInterval: FAST_POLL_INTERVAL
  })

  return useMemo(() => {
    return {
      loading,
      logs: data?.walletLogs ?? [],
      error,
      loadMore: () => {},
      hasMore: false,
      refetch
    }
  }, [data, loading, error, refetch])
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

export function useDeleteWalletLogs (protocol) {
  const showModal = useShowModal()

  return useCallback(async () => {
    const { promise, resolve, reject } = Promise.withResolvers()

    const onClose = () => {
      reject(new ModalClosedError())
    }

    showModal(close => {
      const onDelete = () => {
        resolve()
        close()
      }

      const onClose = () => {
        reject(new ModalClosedError())
        close()
      }

      return (
        <DeleteWalletLogsObstacle
          protocol={protocol}
          onClose={onClose}
          onDelete={onDelete}
        />
      )
    }, { onClose })

    return promise
  }, [showModal])
}

function DeleteWalletLogsObstacle ({ protocol, onClose, onDelete }) {
  const toaster = useToast()
  const [deleteWalletLogs] = useMutation(DELETE_WALLET_LOGS)

  const deleteLogs = useCallback(async () => {
    await deleteWalletLogs({
      variables: { protocolId: protocol ? Number(protocol.id) : undefined }
    })
  }, [protocol, deleteWalletLogs])

  const onClick = useCallback(async () => {
    try {
      await deleteLogs()
      onDelete()
      onClose()
      toaster.success('deleted wallet logs')
    } catch (err) {
      console.error('failed to delete wallet logs:', err)
      toaster.danger('failed to delete wallet logs')
    }
  }, [onClose, deleteLogs, toaster])

  let prompt = 'Do you really want to delete all wallet logs?'
  if (protocol) {
    // TODO(wallet-v2): use "connection" instead of "protocol"?
    prompt = 'Do you really want to delete all logs of this protocol?'
  }

  return (
    <div className='text-center'>
      {prompt}
      <div className='d-flex align-items-center mt-3 mx-auto'>
        <span style={{ cursor: 'pointer' }} className='d-flex ms-auto text-muted fw-bold nav-link mx-3' onClick={onClose}>cancel</span>
        <Button
          className='d-flex me-auto mx-3' variant='danger'
          onClick={onClick}
        >delete
        </Button>
      </div>
    </div>
  )
}
