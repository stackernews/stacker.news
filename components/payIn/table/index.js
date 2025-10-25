import styles from '../table/index.module.css'
import classNames from 'classnames'
import { PayInType } from './type'
import { PayInContext } from '../context'
import { PayInMoney } from './money'
import LinkToContext from '@/components/link-to-context'

export default function PayInTable ({ payIns }) {
  return (
    <div className={styles.table}>
      <div className={classNames(styles.row, styles.header)}>
        <div>type</div>
        <div>context</div>
        <div>sats</div>
      </div>
      {payIns?.map(payIn => (
        <PayInRow key={`${payIn.id}-${payIn.isSend}`} payIn={payIn} />
      ))}
    </div>
  )
}

function PayInRow ({ payIn }) {
  return (
    <div
      className={classNames(styles.row, {
        [styles.failed]: payIn.payInState === 'FAILED',
        [styles.spending]: !!payIn?.payerPrivates,
        [styles.stacking]: !payIn?.payerPrivates
      })}
    >
      <LinkToContext className={styles.type} href={`/transactions/${payIn.id}`}>
        <PayInType payIn={payIn} />
      </LinkToContext>
      <LinkToContext className={styles.context} href={`/transactions/${payIn.id}`}>
        <PayInContext payIn={payIn} />
      </LinkToContext>
      <LinkToContext className={styles.money} href={`/transactions/${payIn.id}`}>
        <PayInMoney payIn={payIn} />
      </LinkToContext>
    </div>
  )
}

export function PayInSkeleton ({ header }) {
  return (
    <div className={styles.table}>
      {header &&
        <div className={classNames(styles.row, styles.header, 'clouds')}>
          <div>type</div>
          <div>context</div>
          <div>sats</div>
        </div>}
      {Array.from({ length: 21 }).map((_, index) => (
        <div className={classNames(styles.row, styles.skeleton, 'clouds')} key={index}>
          <div className={classNames(styles.type, 'clouds')} />
          <div className={classNames(styles.context, 'clouds')} />
          <div className={classNames(styles.money, 'clouds')} />
        </div>
      ))}
    </div>
  )
}
