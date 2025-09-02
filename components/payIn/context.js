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
      return (
        <Invite
          invite={payIn.invite}
          active={!payIn.invite.revoked && !(payIn.invite.limit && payIn.invite.invitees.length >= payIn.invite.limit)}
        />
      )
    case 'PROXY_PAYMENT':
      return <PayInMetadata payInBolt11={payIn.payInBolt11} />
    case 'WITHDRAWAL':
    case 'AUTOWITHDRAWAL':
      return <Bolt11Info bolt11={payIn.payOutBolt11.bolt11} preimage={payIn.payOutBolt11.preimage} />
    case 'DONATE':
      return <small className='text-muted d-flex justify-content-center w-100'>Praise be, you donated to the rewards pool.</small>
    case 'BUY_CREDITS':
      return <small className='text-muted d-flex justify-content-center w-100'>You topped up your cowboycredits.</small>
  }
  return <small className='text-muted d-flex justify-content-center w-100'>N/A</small>
}
