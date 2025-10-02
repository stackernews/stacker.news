import { msatsToSats } from './format'

export function describePayInType (payIn, me) {
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
      default:
        return payTypeShortName(payIn.payInType)
    }
  }

  const t = type()
  if (!payIn.isSend) {
    if (payIn.payInState === 'FAILED' ||
      (['WITHDRAWAL', 'AUTO_WITHDRAWAL'].includes(payIn.payInType) && payIn.payInState === 'PAID')) {
      return t + ' refund'
    }
  }
  if (!payIn.payerPrivates?.userId) {
    return t + ' receive'
  }
  if (payIn.genesisId) {
    return t + ' (retry)'
  }

  return t
}

export function payTypeShortName (type) {
  return type.toLowerCase().replaceAll('_', ' ')
}
