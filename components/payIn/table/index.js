import styles from '../table/index.module.css'
import classNames from 'classnames'
import { PayInType } from './type'
import { PayInContext } from '../context'
import { PayInMoney } from './money'
import { ExternalTransactionRow } from './external'
import LinkToContext from '@/components/link-to-context'
import { FAILED_PAY_IN_STATES } from '@/lib/pay-in'

export default function PayInTable ({ items }) {
  return (
    <div className={styles.table}>
      <div className={classNames(styles.row, styles.header)}>
        <div>type</div>
        <div>context</div>
        <div>sats</div>
      </div>
      {items?.map(item => item.__typename === 'ExternalTransaction'
        ? <ExternalTransactionRow key={`external-${item.id}`} transaction={item} />
        : <PayInRow key={`${item.id}-${item.isSend}`} payIn={item} />)}
    </div>
  )
}

function PayInRow ({ payIn }) {
  const failed = FAILED_PAY_IN_STATES.includes(payIn.payInState)
  return (
    <div
      className={classNames(styles.row, {
        [styles.failed]: failed,
        [styles.stacking]: !payIn.isSend && payIn.payInState === 'PAID'
      })}
    >
      <LinkToContext className={styles.type} href={`/transactions/${payIn.id}`}>
        <PayInType payIn={payIn} />
      </LinkToContext>
      <LinkToContext className={styles.context} href={`/transactions/${payIn.id}`}>
        <div className='flex sm:hidden small justify-center text-muted w-full' />
        <div className='hidden sm:block max-w-full'><PayInContext payIn={payIn} /></div>
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
