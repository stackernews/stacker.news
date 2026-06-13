import classNames from 'classnames'
import { formatBalanceText } from '@/wallets/client/balance/format'
import styles from './balance.module.css'
import { balanceErrorDisplay, balanceLoadingText, balanceSourceTitle } from './text'

export function BalanceRow ({ balanceState }) {
  const { status = 'unavailable', error, source } = balanceState ?? {}
  const title = balanceSourceTitle(source)
  let content = '—'

  if (status === 'ready') {
    content = formatBalanceText(balanceState)
  } else if (status === 'loading') {
    content = <span className={styles.rowLoading}>{balanceLoadingText()}</span>
  } else if (status === 'error') {
    const { message } = balanceErrorDisplay(error)
    if (error === 'busy') {
      content = <span title={message}>busy</span>
    } else {
      content = (
        <span
          className={classNames('fw-bold text-warning', error === 'permanent' && 'text-danger')}
          title={message}
        >!
        </span>
      )
    }
  }

  return (
    <div className={classNames(styles.row, 'text-truncate')} title={title}>
      {content}
    </div>
  )
}
