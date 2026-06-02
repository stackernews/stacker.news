import classNames from 'classnames'
import { formatBalanceParts } from '@/wallets/client/balance/format'
import styles from './balance.module.css'
import { balanceErrorDisplay, balanceLoadingText, balanceSourceTitle } from './text'

export function BalanceHero ({ balanceState }) {
  const { status = 'unavailable', error, source } = balanceState ?? {}

  if (status === 'ready') {
    const { amount, unit } = formatBalanceParts(balanceState)
    return <BigBalance state='ready' amount={amount} unit={unit} title={balanceSourceTitle(source)} />
  }

  if (status === 'loading') {
    return <BigBalance state='loading' amount={balanceLoadingText()} unit='sats' />
  }

  if (status === 'error') {
    return <BigBalance state='error' {...balanceErrorDisplay(error)} />
  }

  return <BigBalance state='unavailable' message='balance not exposed by this connection' />
}

function BigBalance ({ state, amount, unit, message, secondary, title }) {
  if (state === 'ready' || state === 'loading') {
    return (
      <div className={classNames(styles.hero, state === 'loading' && styles.heroLoading)} title={title} aria-live={state === 'loading' ? 'polite' : undefined}>
        <BigBalanceAmount>{amount}</BigBalanceAmount>
        <span className={styles.heroUnit}>{unit}</span>
      </div>
    )
  }

  return (
    <div className={styles.heroUnavailable}>
      <div className={styles.heroDash}>—</div>
      <div className={styles.heroMessage}>{message}</div>
      {secondary && <div className={styles.heroMessageSecondary}>{secondary}</div>}
    </div>
  )
}

function BigBalanceAmount ({ children }) {
  const length = String(children).length

  return (
    <span className={styles.heroAmount} style={{ '--balance-chars': length }}>
      {children}
    </span>
  )
}
