import ItemJob from '@/components/item-job'
import Item from '@/components/item'
import { CommentFlat } from '@/components/comment'
import { TerritoryDetails } from '../territory-header'
import { truncateString } from '@/lib/format'

export function PayInContext ({ payIn }) {
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
          {payIn.item.isJob && <ItemJob item={payIn.item} />}
          {payIn.item.title && <Item item={payIn.item} siblingComments />}
        </>
      )
    case 'TERRITORY_CREATE':
    case 'TERRITORY_UPDATE':
    case 'TERRITORY_BILLING':
    case 'TERRITORY_UNARCHIVE':
      return <TerritoryDetails sub={{ ...payIn.sub, desc: truncateString(payIn.sub.desc, 280) }} className='w-100' show={false} />
    case 'INVITE_GIFT':
      return <div>TODO: Invite</div>
    case 'PROXY_PAYMENT':
      return <div>TODO: Proxy Payment</div>
    case 'WITHDRAWAL':
    case 'AUTOWITHDRAWAL':
    case 'DONATE':
    case 'BUY_CREDITS':
  }
  return <small className='text-muted d-flex justify-content-center w-100'>N/A</small>
}
