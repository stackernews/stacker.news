import { Button } from 'react-bootstrap'
import styles from '@/styles/logger.module.css'
import { useWalletLogs, useDeleteWalletLogs } from '@/wallets/client/hooks'
import { useCallback, useEffect, useState, Fragment } from 'react'
import { timeSince } from '@/lib/time'
import classNames from 'classnames'
import { ModalClosedError } from '@/components/modal'
import { isTemplate } from '@/wallets/lib/util'

// TODO(wallet-v2):
//   when we delete logs for a protocol, the cache is not updated
//   so when we go to all wallet logs, we still see the deleted logs until the query is refetched

export function WalletLogs ({ protocol, className, debug }) {
  const { logs, loadMore, hasMore, loading, clearLogs } = useWalletLogs(protocol, debug)
  const deleteLogs = useDeleteWalletLogs(protocol, debug)

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

  // avoid unnecessary clutter when attaching new wallet
  const hideLogs = logs.length === 0 && protocol && isTemplate(protocol)
  if (hideLogs) return null

  // showing delete button and logs footer for temporary template logs is unnecessary clutter
  const template = protocol && isTemplate(protocol)

  return (
    <div className={className}>
      {!template && (
        <div className='d-flex w-100 align-items-center mb-3'>
          <span
            style={{ cursor: 'pointer' }}
            className='text-muted fw-bold nav-link ms-auto' onClick={onDelete}
          >clear logs
          </span>
        </div>
      )}
      <div className={classNames(styles.container, embedded && styles.embedded)}>
        {logs.map((log, i) => (
          <LogMessage
            key={i}
            tag={protocol ? null : log.wallet?.name}
            level={log.level}
            message={log.message}
            context={log.context}
            payIn={log.payIn}
            ts={log.createdAt}
          />
        ))}
        {!template && <WalletLogsFooter empty={logs.length === 0} loading={loading} hasMore={hasMore} loadMore={loadMore} />}
      </div>
    </div>
  )
}

function WalletLogsFooter ({ empty, loading, hasMore, loadMore }) {
  return (
    <>
      {loading
        ? <div className='w-100 text-center'>loading...</div>
        : empty && <div className='w-100 text-center'>empty</div>}
      {hasMore
        ? <div className='w-100 text-center'><Button onClick={loadMore} size='sm' className='mt-3'>more</Button></div>
        : <div className='w-100 text-center'>------ start of logs ------</div>}
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
