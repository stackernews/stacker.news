import { USER_ID } from '@/lib/constants'

export function getRedistributedPayOutCustodialTokens ({ sub, payOutCustodialTokens = [], payOutBolt11 = { msats: 0n }, mcost }) {
  const remainingMtokens = mcost - payOutBolt11.msats - payOutCustodialTokens.reduce((acc, token) => acc + token.mtokens, 0n)
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

  const rewardMtokens = remainingMtokens - revenueMtokens
  payOutCustodialTokensCopy.push({
    payOutType: 'REWARDS_POOL',
    userId: USER_ID.rewards,
    mtokens: rewardMtokens,
    custodialTokenType: 'SATS'
  })

  return payOutCustodialTokensCopy
}
