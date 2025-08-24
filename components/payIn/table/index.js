import styles from './index.module.css'
import { useMe } from '../../me'
import classNames from 'classnames'
import { PayInType } from './type'
import { PayInDetail } from './detail'
import { PayInMoney } from './money'
import LinkToContext from '@/components/link-to-context'

export default function PayInTable ({ payIns }) {
  return (
    <div className={styles.table}>
      {payIns?.map(payIn => (
        <PayInRow key={payIn.id} payIn={payIn} />
      ))}
    </div>
  )
}

function PayInRow ({ payIn }) {
  const { me } = useMe()

  return (
    <div
      className={classNames(styles.row, {
        [styles.failed]: payIn.payInState === 'FAILED',
        [styles.spending]: Number(payIn.userId) === Number(me.id),
        [styles.stacking]: Number(payIn.userId) !== Number(me.id)
      })}
    >
      <LinkToContext className={styles.type} href={`/transactions/${payIn.id}`}>
        <PayInType payIn={payIn} />
      </LinkToContext>
      <LinkToContext className={styles.detail} href={`/transactions/${payIn.id}`}>
        <PayInDetail payIn={payIn} />
      </LinkToContext>
      <LinkToContext className={styles.money} href={`/transactions/${payIn.id}`}>
        <PayInMoney payIn={payIn} />
      </LinkToContext>
    </div>
  )
}
