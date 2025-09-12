import { USER_ID } from '@/lib/constants'

export function getRedistributedPayOutCustodialTokens ({ sub, payOutCustodialTokens = [], payOutBolt11 = { msats: 0n }, mcost }) {
  // routing fee is only deducted from rewards pool, so it can be added back to the rewards pool when the actual routing fee is known
  const remainingMtokens = mcost - payOutBolt11.msats -
    payOutCustodialTokens.filter(t => t.payOutType !== 'ROUTING_FEE').reduce((acc, token) => acc + token.mtokens, 0n)
  if (remainingMtokens < 0n) {
    throw new Error('remaining mtokens is less than 0')
  }

  if (remainingMtokens === 0n) {
    return [...payOutCustodialTokens]
  }

  const payOutCustodialTokensCopy = [...payOutCustodialTokens]
  let revenueMtokens = 0n
  if (sub) {
    revenueMtokens = remainingMtokens * (100n - BigInt(sub.rewardsPct)) / 100n
    payOutCustodialTokensCopy.push({
      payOutType: 'TERRITORY_REVENUE',
      userId: sub.userId,
      mtokens: revenueMtokens,
      custodialTokenType: 'SATS',
      subPayOutCustodialToken: {
        subName: sub.name
      }
    })
  }

  const routingFeeMtokens = payOutCustodialTokens.find(t => t.payOutType === 'ROUTING_FEE')?.mtokens ?? 0n
  const rewardMtokens = remainingMtokens - revenueMtokens - routingFeeMtokens
  payOutCustodialTokensCopy.push({
    payOutType: 'REWARDS_POOL',
    userId: USER_ID.rewards,
    mtokens: rewardMtokens,
    custodialTokenType: 'SATS'
  })

  return payOutCustodialTokensCopy
}
