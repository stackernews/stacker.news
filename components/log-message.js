import { timeSince } from '@/lib/time'
import styles from './log-message.module.css'

export default function LogMessage ({ showWallet, wallet, level, message, ts }) {
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
  return (
    <tr className={styles.line}>
      <td className={styles.timestamp}>{timeSince(new Date(ts))}</td>
      {showWallet ? <td className={styles.wallet}>[{wallet}]</td> : <td className='mx-1' />}
      <td className={`${styles.level} ${className}`}>{level}</td>
      <td>{message}</td>
    </tr>
  )
}
