import { timeSince } from '@/lib/time'
import styles from '@/styles/log.module.css'
import { useState } from 'react'

export default function LogMessage ({ showWallet, wallet, level, message, context, ts }) {
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
