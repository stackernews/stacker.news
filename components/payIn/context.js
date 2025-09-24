import ItemJob from '@/components/item-job'
import Item from '@/components/item'
import { CommentFlat } from '@/components/comment'
import { TerritoryDetails } from '../territory-header'
import { truncateString } from '@/lib/format'
import Invite from '../invite'
import Bolt11Info from './bolt11-info'
import { PayInMetadata } from './metadata'

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
          {(!payIn.item.title && <CommentFlat item={payIn.item} includeParent noReply truncate />) ||
              (payIn.item.isJob && <ItemJob item={payIn.item} />) ||
              (payIn.item.title && <Item item={payIn.item} siblingComments />)}
        </>
      )
    case 'TERRITORY_CREATE':
    case 'TERRITORY_UPDATE':
    case 'TERRITORY_BILLING':
    case 'TERRITORY_UNARCHIVE':
      if (!payIn.payerPrivates.sub) return <small className='text-muted d-flex justify-content-center w-100'>N/A</small>
      return <TerritoryDetails sub={{ ...payIn.payerPrivates.sub, desc: truncateString(payIn.payerPrivates.sub.desc, 280) }} className='w-100' show={false} />
    case 'INVITE_GIFT':
      if (!payIn.payerPrivates.invite) return <small className='text-muted d-flex justify-content-center w-100'>N/A</small>
      return (
        <Invite
          invite={payIn.payerPrivates.invite}
          active={!payIn.payerPrivates.invite.revoked && !(payIn.payerPrivates.invite.limit && payIn.payerPrivates.invite.invitees.length >= payIn.payerPrivates.invite.limit)}
        />
      )
    case 'PROXY_PAYMENT':
      return <PayInMetadata payInBolt11={payIn.payerPrivates.payInBolt11} />
    case 'WITHDRAWAL':
    case 'AUTOWITHDRAWAL':
      return <Bolt11Info bolt11={payIn.payeePrivates.payOutBolt11.bolt11} preimage={payIn.payeePrivates.payOutBolt11.preimage} />
    case 'DONATE':
      return <small className='text-muted d-flex justify-content-center w-100'>Praise be, you donated to the rewards pool.</small>
    case 'BUY_CREDITS':
      return <small className='text-muted d-flex justify-content-center w-100'>You topped up your cowboy credits.</small>
  }
  return <small className='text-muted d-flex justify-content-center w-100'>N/A</small>
}
