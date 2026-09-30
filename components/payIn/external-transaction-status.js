import Check from '@/svgs/check-double-line.svg'
import ThumbDown from '@/svgs/thumb-down-fill.svg'
import Moon from '@/svgs/moon-fill.svg'
import ErrorWarning from '@/svgs/error-warning-fill.svg'
import { StatusText, statusIconSize } from './status'
import classNames from 'classnames'

export function ExternalTransactionStatus ({ transaction, className }) {
  const { Icon, fillClass, color, label, spin } = externalStatusPresentation(transaction)
  return (
    <div className={classNames('flex items-center', className)}>
      <Icon width={statusIconSize} height={statusIconSize} className={classNames(fillClass, spin && 'spin')} />
      <StatusText color={color}>{label}</StatusText>
    </div>
  )
}

function externalStatusPresentation (transaction) {
  switch (transaction.status) {
    case 'SETTLED': return { Icon: Check, fillClass: 'fill-success', color: 'success', label: 'settled' }
    case 'FAILED': return { Icon: ThumbDown, fillClass: 'fill-danger', color: 'danger', label: 'failed' }
    case 'EXPIRED': return { Icon: ThumbDown, fillClass: 'fill-danger', color: 'danger', label: 'expired' }
    case 'UNKNOWN': return { Icon: ErrorWarning, fillClass: 'fill-warning', color: 'warning', label: 'unknown' }
    default: return { Icon: Moon, fillClass: 'fill-muted', color: 'muted', label: 'pending', spin: true }
  }
}
