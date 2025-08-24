import styles from './index.module.css'
import ItemJob from '@/components/item-job'
import Item from '@/components/item'
import { CommentFlat } from '@/components/comment'
import { TerritoryDetails } from '../../territory-header'

export function PayInDetail ({ payIn }) {
  switch (payIn.payInType) {
    case 'ITEM_CREATE':
    case 'ITEM_UPDATE':
    case 'ZAP':
    case 'DOWN_ZAP':
    case 'BOOST':
    case 'POLL_VOTE':
      return (
        <>
          {!payIn.item.title && <CommentFlat item={payIn.item} includeParent noReply truncate />}
          {payIn.item.isJob && <ItemJob className={styles.itemWrapper} item={payIn.item} />}
          {payIn.item.title && <Item item={payIn.item} siblingComments />}
        </>
      )
    case 'TERRITORY_CREATE':
    case 'TERRITORY_UPDATE':
    case 'TERRITORY_BILLING':
    case 'TERRITORY_UNARCHIVE':
      return <TerritoryDetails sub={payIn.sub} />
    case 'INVITE_GIFT':
      return <div>Invite</div>
    case 'DONATE':
      return <div>Donate</div>
    case 'BUY_CREDITS':
      return <div>Buy Credits</div>
    case 'PROXY_PAYMENT':
      return <div>Proxy Payment</div>
    case 'WITHDRAWAL':
      return <div>Withdrawal</div>
    case 'AUTOWITHDRAWAL':
      return <div>AutoWithdrawal</div>
  }
  return <div>should be payIn.detail</div>
}
