import ItemJob from '@/components/item-job'
import Item from '@/components/item'
import { CommentFlat } from '@/components/comment'
import { TerritoryDetails } from '../territory-header'
import { truncateString } from '@/lib/format'
import Invite from '../invite'
import Bolt11Info, { toBolt11InfoProps } from './bolt11-info'

// which payIn types render a bolt11 as their context, and which bolt11 they render
const PAY_IN_CONTEXT_BOLT11 = {
  PROXY_PAYMENT: payIn => payIn.payerPrivates?.payInBolt11,
  WITHDRAWAL: payIn => payIn.payeePrivates?.payOutBolt11,
  AUTO_WITHDRAWAL: payIn => payIn.payeePrivates?.payOutBolt11
}

export const payInContextIsInvoiceDetails = payIn => payIn.payInType in PAY_IN_CONTEXT_BOLT11

export function PayInContext ({ payIn }) {
  const contextBolt11 = PAY_IN_CONTEXT_BOLT11[payIn.payInType]
  if (contextBolt11) {
    return <Bolt11Info {...toBolt11InfoProps(contextBolt11(payIn))} />
  }
  switch (payIn.payInType) {
    case 'ITEM_CREATE':
    case 'ITEM_UPDATE':
    case 'ZAP':
    case 'BOOST':
    case 'POLL_VOTE':
    case 'BOUNTY_PAYMENT':
      if (!payIn.item) {
        return <small className='text-muted d-flex justify-content-center w-100'>item unavailable</small>
      }
      return (
        <>
          {(!payIn.item.title && <CommentFlat item={payIn.item} includeParent noReply truncate />) ||
              (payIn.item.isJob && <ItemJob item={payIn.item} />) ||
              (payIn.item.title && <Item item={payIn.item} siblingComments />)}
        </>
      )
    case 'DOWN_ZAP':
      return <small className='text-muted d-flex justify-content-center w-100'>N/A</small>
    case 'TERRITORY_CREATE':
    case 'TERRITORY_UPDATE':
    case 'TERRITORY_BILLING':
    case 'TERRITORY_UNARCHIVE':
      if (!payIn.payerPrivates?.sub) return <small className='text-muted d-flex justify-content-center w-100'>N/A</small>
      // note: we're drilling truncated down to the TerritoryInfo component, TODO: revise
      return <TerritoryDetails truncated sub={{ ...payIn.payerPrivates.sub, desc: truncateString(payIn.payerPrivates.sub.desc, 280) }} className='w-100' show={false} />
    case 'INVITE_GIFT':
      if (!payIn.payerPrivates?.invite) return <small className='text-muted d-flex justify-content-center w-100'>N/A</small>
      return (
        <Invite
          invite={payIn.payerPrivates.invite}
          active={!payIn.payerPrivates.invite.revoked && !payIn.payerPrivates.invite.full}
        />
      )
    case 'DONATE':
      return <small className='text-muted d-flex justify-content-center w-100'>Praise be, you donated to the rewards pool.</small>
    case 'BUY_CREDITS':
      return <small className='text-muted d-flex justify-content-center w-100'>You topped up your cowboy credits.</small>
  }
  return <small className='text-muted d-flex justify-content-center w-100'>N/A</small>
}
