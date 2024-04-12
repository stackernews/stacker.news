import { timeSince } from '@/lib/time'
import styles from './log-message.module.css'

export default function LogMessage ({ wallet, level, message, ts }) {
  level = level.toLowerCase()
  const levelClassName = ['ok', 'success'].includes(level) ? 'text-success' : level === 'error' ? 'text-danger' : level === 'info' ? 'text-info' : ''
  return (
    <tr className={styles.line}>
      <td className={styles.timestamp}>{timeSince(new Date(ts))}</td>
      <td className={styles.wallet}>[{wallet}]</td>
      <td className={`${styles.level} ${levelClassName}`}>{level === 'success' ? 'ok' : level}</td>
      <td>{message}</td>
    </tr>
  )
}
