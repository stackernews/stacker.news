import { msatsToSats } from './format'

export function describePayInType (payIn, meId) {
  function type () {
    switch (payIn.payInType) {
      case 'ITEM_CREATE':
        if (payIn.item.isJob) {
          return 'job'
        } else if (payIn.item.title) {
          return 'post'
        } else if (payIn.item.parentId) {
          return 'comment'
        } else {
          return 'item'
        }
      case 'ITEM_UPDATE':
        if (payIn.item.isJob) {
          return 'job edit'
        } else if (payIn.item.title) {
          return 'post edit'
        } else if (payIn.item.parentId) {
          return 'comment edit'
        } else {
          return 'item edit'
        }
      case 'ZAP':
        if (payIn.item?.root?.bounty === msatsToSats(payIn.mcost)) {
          return 'pay bounty'
        } else {
          return 'zap'
        }
      case 'DOWN_ZAP':
        return 'downzap'
      case 'BOOST':
        return 'boost'
      case 'POLL_VOTE':
        return 'poll vote'
      case 'TERRITORY_CREATE':
        return 'territory created'
      case 'TERRITORY_UPDATE':
        return 'territory updated'
      case 'TERRITORY_BILLING':
        return 'territory billing'
      case 'TERRITORY_UNARCHIVE':
        return 'territory unarchived'
      case 'INVITE_GIFT':
        return 'invite gift'
      case 'DONATE':
        return 'donate'
      case 'BUY_CREDITS':
        return 'buy credits'
      case 'PROXY_PAYMENT':
        return 'proxy payment'
      case 'WITHDRAWAL':
        return 'withdrawal'
      case 'AUTOWITHDRAWAL':
        return 'autowithdrawal'
      default:
        return 'unknown'
    }
  }

  const t = type()
  if (Number(payIn.userId) !== Number(meId)) {
    return t + ' receive'
  }

  return t
}
