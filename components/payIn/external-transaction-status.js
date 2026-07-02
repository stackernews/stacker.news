import classNames from 'classnames'
import Check from '@/svgs/check-double-line.svg'
import ThumbDown from '@/svgs/thumb-down-fill.svg'
import Moon from '@/svgs/moon-fill.svg'
import ErrorWarning from '@/svgs/error-warning-fill.svg'
import { StatusText, statusIconSize } from './status'

export function ExternalTransactionStatus ({ transaction, className }) {
  const { Icon, fill, color, label, spin } = {
    SETTLED: { Icon: Check, fill: 'success', color: 'success', label: 'settled' },
    FAILED: { Icon: ThumbDown, fill: 'danger', color: 'danger', label: 'failed' },
    UNKNOWN: { Icon: ErrorWarning, fill: 'warning', color: 'warning', label: 'unknown' }
  }[transaction.settlementStatus] ?? { Icon: Moon, fill: 'grey', color: 'muted', label: 'pending', spin: true }

  return (
    <div className={classNames('d-flex align-items-center', className)}>
      <Icon width={statusIconSize} height={statusIconSize} className={`fill-${fill}${spin ? ' spin' : ''}`} />
      <StatusText color={color}>{label}</StatusText>
    </div>
  )
}
