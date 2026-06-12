import SendIcon from '@/svgs/arrow-right-up-line.svg'
import RecvIcon from '@/svgs/arrow-left-down-line.svg'
import styles from './rows.module.css'

// Imports rows.module.css so `.statusIcon` etc. are hashed in the same file as
// the coupling selectors (.statusPill .statusIcon, .templateSupport .statusIcon)
// and those descendant rules still match.

const STATUS_STYLE = {
  OK: { '--state-bg': '#28a745', '--state-color': '#fff' },
  ERROR: { '--state-bg': '#dc3545', '--state-color': '#fff' },
  WARNING: { '--state-bg': '#fd7e14', '--state-color': '#fff' },
  DISABLED: { '--state-bg': 'var(--theme-toolbarHover)', '--state-color': 'var(--theme-grey)' },
  SUPPORTED: {
    '--state-bg': 'var(--bs-body-bg)',
    '--state-color': 'var(--theme-grey)',
    '--status-line-color': 'color-mix(in srgb, var(--theme-borderColor) 88%, #000)'
  }
}

function StatusIcon ({ icon: Icon, status, label }) {
  return (
    <span className={styles.statusPill} style={STATUS_STYLE[status]} title={`${label}: ${status.toLowerCase()}`} aria-label={`${label}: ${status.toLowerCase()}`}>
      <Icon className={styles.statusIcon} />
      <span className={styles.statusDivider} aria-hidden />
      <span className={styles.statusLabel}>{label}</span>
    </span>
  )
}

// receive/send are status strings ('OK' | 'SUPPORTED' | ...) or falsy to hide
// that pill. className styles the wrapper (live rows vs static template list).
export function WalletStatusPills ({ receive, send, className }) {
  return (
    <span className={className}>
      {receive && <StatusIcon icon={RecvIcon} status={receive} label='receive' />}
      {send && <StatusIcon icon={SendIcon} status={send} label='send' />}
    </span>
  )
}
