import { formatMsats, satsToMsats } from '@/lib/format'
import { timeSince } from '@/lib/time'
import styles from '@/styles/log.module.css'
import { Fragment, useState } from 'react'

export default function LogMessage ({ showWallet, wallet, level, message, context, invoice, withdrawl, ts }) {
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

  // send logs are still saved on the client and use a context JSON column
  const ctx = context ?? withdrawl ?? invoice
  const filtered = ctx
    ? Object.keys(ctx)
      .filter(key => !['send', 'recv', 'status', '__typename'].includes(key))
      .reduce((obj, key) => {
        const value = ctx[key]
        obj[key] = value
        // send logs already save amount as formatted string
        if (key === 'amount' && typeof value === 'number') {
          obj[key] = formatMsats(satsToMsats(value))
        }
        return obj
      }, {})
    : {}

  const hasContext = ctx && Object.keys(filtered).length > 0

  const handleClick = () => {
    if (hasContext) { setShow(show => !show) }
  }

  const style = hasContext ? { cursor: 'pointer' } : { cursor: 'inherit' }
  const indicator = hasContext ? (show ? '-' : '+') : <></>

  return (
    <>
      <tr className={styles.tableRow} onClick={handleClick} style={style}>
        <td className={styles.timestamp}>{timeSince(new Date(ts))}</td>
        {showWallet ? <td className={styles.wallet}>[{wallet}]</td> : <td className='mx-1' />}
        <td className={`${styles.level} ${className}`}>{level}</td>
        <td>{message}</td>
        <td>{indicator}</td>
      </tr>
      {show && hasContext && Object.entries(filtered)
        .map(([key, value], i) => {
          const last = i === Object.keys(filtered).length - 1
          return (
            <tr className={styles.line} key={i}>
              <td />
              <td className={last ? 'pb-2 pe-1' : 'pe-1'} colSpan='2'>{key}</td>
              <td className={last ? 'text-break pb-2' : 'text-break'}>{value}</td>
            </tr>
          )
        })}
    </>
  )
}
