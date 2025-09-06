import { CommentFlat } from '@/components/comment'
import Item from '@/components/item'
import ItemJob from '@/components/item-job'
import classNames from 'classnames'

export default function PayInResult ({ payIn }) {
  if (!payIn.result || !payIn.itemPayIn) return null

  let className = 'text-info'
  let actionString = ''

  switch (payIn.payInState) {
    case 'FAILED':
    case 'RETRYING':
      actionString += 'attempted '
      className = 'text-warning'
      break
    case 'PAID':
      actionString += 'successful '
      className = 'text-success'
      break
    default:
      actionString += 'pending '
  }

  switch (payIn.payInType) {
    case 'ITEM_CREATE':
      actionString += 'item creation'
      break
    case 'ZAP':
      actionString += 'zap on item'
      break
    case 'DOWN_ZAP':
      actionString += 'downzap on item'
      break
    case 'POLL_VOTE':
      actionString += 'poll vote'
      break
  }

  return (
    <div className='text-start w-100 my-3'>
      <div className={classNames('fw-bold', 'pb-1', className)}>{actionString}</div>
      {(payIn.payInItem?.item?.isJob && <ItemJob item={payIn?.payInItem?.item} />) ||
       (payIn.payInItem?.item?.title && <Item item={payIn?.payInItem?.item} />) ||
         <CommentFlat item={payIn.payInItem?.item} includeParent noReply truncate />}
    </div>
  )
}
