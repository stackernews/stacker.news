import { USER_ID } from '@/lib/constants'

export function getRedistributedPayOutCustodialTokens ({ subs = [], payOutCustodialTokens = [], payOutBolt11 = { msats: 0n }, mcost, rewardsPct }) {
  // routing fee is only deducted from rewards pool, so it can be added back to the rewards pool when the actual routing fee is known
  const remainingMtokens = mcost - payOutBolt11.msats -
    payOutCustodialTokens.filter(t => t.payOutType !== 'ROUTING_FEE').reduce((acc, token) => acc + token.mtokens, 0n)
  if (remainingMtokens < 0n) {
    throw new Error('remaining mtokens is less than 0')
  }

  const payOutCustodialTokensCopy = [...payOutCustodialTokens]
  let totalRevenueMtokens = 0n
  if (subs?.length > 0) {
    // total sub costs for proportional distribution
    // uses even split if subs don't have individual mcosts
    const totalSubMcost = subs.reduce((acc, sub) => acc + (sub.mcost ?? 0n), 0n)
    const useProportional = totalSubMcost > 0n
    for (const sub of subs) {
      const subShare = useProportional
        ? remainingMtokens * (sub.mcost ?? 0n) / totalSubMcost
        : remainingMtokens / BigInt(subs.length)

      const revenueMtokens = subShare * (100n - BigInt(rewardsPct ?? sub.rewardsPct)) / 100n
      totalRevenueMtokens += revenueMtokens
      payOutCustodialTokensCopy.push({
        payOutType: 'TERRITORY_REVENUE',
        userId: sub.userId,
        mtokens: revenueMtokens,
        custodialTokenType: 'SATS',
        subPayOutCustodialToken: {
          subId: sub.id
        }
      })
    }
  }

  // XXX this is here because even if there isn't territory revenue, we want an entry
  // of payOutCustodialToken for the territory
  if (remainingMtokens === 0n) {
    return payOutCustodialTokensCopy
  }

  const routingFeeMtokens = payOutCustodialTokens.find(t => t.payOutType === 'ROUTING_FEE')?.mtokens ?? 0n
  const rewardMtokens = remainingMtokens - totalRevenueMtokens - routingFeeMtokens
  payOutCustodialTokensCopy.push({
    payOutType: 'REWARDS_POOL',
    userId: USER_ID.rewards,
    mtokens: rewardMtokens,
    custodialTokenType: 'SATS'
  })

  return payOutCustodialTokensCopy
}

export function payOutCustodialTokenFromBolt11 (payOutBolt11) {
  return {
    payOutType: payOutBolt11.payOutType,
    userId: payOutBolt11.userId,
    mtokens: payOutBolt11.msats,
    custodialTokenType: 'CREDITS'
  }
}
