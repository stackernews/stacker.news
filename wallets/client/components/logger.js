import { Button } from 'react-bootstrap'
import styles from '@/styles/logger.module.css'
import { useWalletLogs, useDeleteWalletLogs } from '@/wallets/client/hooks/logger'
import { useCallback, useEffect, useState, Fragment } from 'react'
import { timeSince } from '@/lib/time'
import classNames from 'classnames'
import MoreFooter from '@/components/more-footer'

export function WalletLogs ({ wallet, payInId, className, poll = true, pollInterval }) {
  const { logs, loadMore, cursor, hasMore, loading, clearLogs } = useWalletLogs(payInId, {
    poll,
    pollInterval,
    walletId: wallet ? Number(wallet.id) : undefined
  })
  const deleteLogs = useDeleteWalletLogs(wallet)

  const onDelete = useCallback(() => {
    deleteLogs({ onSuccess: clearLogs })
  }, [deleteLogs, clearLogs])

  const transaction = payInId !== undefined

  return (
    <div className={className}>
      {!transaction && (
        <div className='d-flex w-100 align-items-center mb-3'>
          <span
            style={{ cursor: 'pointer' }}
            className='text-muted fw-bold nav-link ms-auto' onClick={onDelete}
          >clear logs
          </span>
        </div>
      )}
      <div className={classNames(styles.container, transaction && styles.embedded, transaction && styles.transaction)}>
        {logs.map((log, i) => (
          <LogMessage
            key={log.id ?? i}
            tag={log.wallet?.name}
            level={log.level}
            message={log.message}
            context={log.context}
            ts={log.createdAt}
          />
        ))}
        {transaction
          ? <WalletLogsFooter empty={logs.length === 0} loading={loading} hasMore={hasMore} loadMore={loadMore} />
          : <WalletLogsPageFooter loading={loading} cursor={cursor} count={logs.length} loadMore={loadMore} />}
      </div>
    </div>
  )
}

function WalletLogsPageFooter ({ loading, cursor, count, loadMore }) {
  if (loading && count === 0) {
    return <div className='w-100 text-center'>loading...</div>
  }

  return <MoreFooter cursor={cursor} count={count} fetchMore={loadMore} Skeleton={WalletLogsLoading} noMoreText='START' />
}

function WalletLogsLoading () {
  return <div className='w-100 text-center'>loading...</div>
}

function WalletLogsFooter ({ empty, loading, hasMore, loadMore }) {
  return (
    <>
      {loading
        ? <div className='w-100 text-center'>loading...</div>
        : empty && <div className='w-100 text-center'>no activity</div>}
      {hasMore && <div className='w-100 text-center'><Button onClick={loadMore} size='sm' className='mt-3'>more</Button></div>}
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
        <Tag tag={tag === null ? null : tag?.toLowerCase() ?? 'system'} />
        <Message message={message} />
        <Indicator show={showContext} visible={hasContext} />
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
  return <div className={styles.tag}>{tag ? `[${tag}]` : null}</div>
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
    case 'warn':
    case 'warning':
      level = 'warn'
      className = 'text-warning'; break
    case 'info':
      className = 'text-info'; break
    default:
      className = 'text-muted'; break
  }

  return <div className={classNames(styles.level, className)}>{level}</div>
}

function Message ({ message }) {
  return <div className={styles.message}>{message}</div>
}

function Indicator ({ show, visible }) {
  return <div className={styles.indicator}>{visible ? (show ? '-' : '+') : null}</div>
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
