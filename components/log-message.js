import { timeSince } from '@/lib/time'
import styles from './log-message.module.css'

export default function LogMessage ({ wallet, level, message, ts }) {
  const levelClassName = level === 'ok' ? 'text-success' : level === 'error' ? 'text-danger' : level === 'info' ? 'text-info' : ''
  return (
    <div className={styles.line}>
      <span className={styles.timestamp}>{timeSince(new Date(ts))}</span>
      <span className='fw-bold mx-1'>[{wallet}]</span>
      <span className={`fw-bold ${styles.level} ${levelClassName}`}>{level}</span>
      <span>{message}</span>
    </div>
  )
}
