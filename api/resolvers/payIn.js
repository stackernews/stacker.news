function payInResultType (payInType) {
  switch (payInType) {
    case 'ITEM_CREATE':
    case 'ITEM_UPDATE':
      return 'Item'
    case 'ZAP':
    case 'DOWN_ZAP':
    case 'BOOST':
      return 'ItemActResult'
    case 'POLL_VOTE':
      return 'PollVoteResult'
    case 'TERRITORY_CREATE':
    case 'TERRITORY_UPDATE':
    case 'TERRITORY_BILLING':
    case 'TERRITORY_UNARCHIVE':
      return 'Sub'
    case 'DONATE':
      return 'DonateResult'
    case 'BUY_CREDITS':
      return 'BuyCreditsResult'
    default:
      return payInType
  }
}

export default {
  PayIn: {
    result: (parent, args) => {
      return { ...parent.result, __typename: payInResultType(parent.payInType) }
    }
  }
}
