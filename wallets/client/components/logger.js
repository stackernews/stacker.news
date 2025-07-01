import { Button } from 'react-bootstrap'
import styles from '@/styles/logger.module.css'
import { useWalletLogs, useDeleteWalletLogs } from '@/wallets/client/hooks'
import { useCallback, useEffect, useState, Fragment } from 'react'
import { timeSince } from '@/lib/time'
import classNames from 'classnames'
import { ModalClosedError } from '@/components/modal'

// TODO(wallet-v2):
//   when we delete logs for a protocol, the cache is not updated
//   so when we go to all wallet logs, we still see the deleted logs until the query is refetched

export function WalletLogs ({ protocol, className }) {
  const { logs, loadMore, hasMore, loading, clearLogs } = useWalletLogs(protocol)
  const deleteLogs = useDeleteWalletLogs(protocol)

  const onDelete = useCallback(async () => {
    try {
      await deleteLogs()
      clearLogs()
    } catch (err) {
      if (err instanceof ModalClosedError) {
        return
      }
      console.error('error deleting logs:', err)
    }
  }, [deleteLogs, clearLogs])

  const embedded = !!protocol

  return (
    <>
      <div className={classNames('d-flex w-100 align-items-center mb-3', className)}>
        <span
          style={{ cursor: 'pointer' }}
          className='text-muted fw-bold nav-link ms-auto' onClick={onDelete}
        >clear logs
        </span>
      </div>
      <div className={classNames(styles.container, embedded && styles.embedded)}>
        {logs.map((log, i) => (
          <LogMessage
            key={i}
            tag={log.wallet?.name}
            level={log.level}
            message={log.message}
            context={log.context}
            ts={log.createdAt}
          />
        ))}
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

export function LogMessage ({ tag, level, message, context, ts }) {
  const [show, setShow] = useState(false)

  let className
  switch (level.toLowerCase()) {
    case 'ok':
    case 'success':
      level = 'ok'
      className = 'text-success'; break
    case 'error':
      className = 'text-danger'; break
    case 'warn':
      className = 'text-warning'; break
    default:
      className = 'text-info'
  }

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
    if (hasContext) { setShow(show => !show) }
  }

  const style = hasContext ? { cursor: 'pointer' } : { cursor: 'inherit' }
  const indicator = hasContext ? (show ? '-' : '+') : <></>

  // TODO(wallet-v2): show invoice context

  return (
    <>
      <div className={styles.row} onClick={handleClick} style={style}>
        <TimeSince timestamp={ts} />
        <div className={styles.tag}>{`[${nameToTag(tag)}]`}</div>
        <div className={`${styles.level} ${className}`}>{level}</div>
        <div className={styles.message}>{message}</div>
        <div className={styles.indicator}>{indicator}</div>
      </div>
      {show && hasContext && (
        <div className={styles.context}>
          {Object.entries(filtered)
            .map(([key, value], i) => {
              return (
                <Fragment key={i}>
                  <div>{key}:</div>
                  <div className='text-break'>{value}</div>
                </Fragment>
              )
            })}
        </div>
      )}
    </>
  )
}

function nameToTag (name) {
  switch (name) {
    case undefined: return 'system'
    case 'ALBY_BROWSER_EXTENSION': return 'alby'
    default: return name.toLowerCase()
  }
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
