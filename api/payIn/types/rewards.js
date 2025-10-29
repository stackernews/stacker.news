import { PAID_ACTION_PAYMENT_METHODS, USER_ID } from '@/lib/constants'
import { notifyEarner } from '@/lib/webPush'

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS
]

export const systemOnly = true

// this makes the proportions add up to 1 and then apportions the total mtokens to the prospects
// it then rounds down to the nearest integer and adds any remaining mtokens to the prospect with the highest proportion
// adding a field to the prospect called apportionedMtokens
function apportionment (prospects, totalMtokens, proportionFieldName) {
  const totalProportion = prospects.reduce((acc, prospect) => acc + prospect[proportionFieldName], 0)
  const normalizedProspects = prospects.map(prospect => {
    return {
      ...prospect,
      normalizedProportion: prospect[proportionFieldName] / totalProportion
    }
  })
  const apportionedProspects = normalizedProspects.map(prospect => {
    return {
      ...prospect,
      apportionedMtokens: Math.floor(prospect.normalizedProportion * totalMtokens)
    }
  })
  const remainingMtokens = totalMtokens - apportionedProspects.reduce((acc, prospect) => acc + prospect.apportionedMtokens, 0)
  if (remainingMtokens > 0) {
    const maxProportion = Math.max(...apportionedProspects.map(prospect => prospect.normalizedProportion))
    const maxProportionIndex = apportionedProspects.findIndex(prospect => prospect.normalizedProportion === maxProportion)
    apportionedProspects[maxProportionIndex].apportionedMtokens += remainingMtokens
  }
  return apportionedProspects
}

export async function getInitial (models, { totalMsats, rewardProspects }) {
  const payOutCustodialTokens = []

  let totalRewardedMsats = 0
  const apportionedProspects = apportionment(rewardProspects, totalMsats, 'total_proportion')
  for (const prospect of apportionedProspects) {
    // referrer, if it exists, gets 10% of the earner's mtokens
    const referrerId = prospect.foreverReferrerId ?? prospect.oneDayReferrerId
    let referrerMtokens = 0
    if (referrerId) {
      referrerMtokens = Math.floor(parseFloat(prospect.apportionedMtokens * 0.1)) // 10% of earnings
    }
    const earnerMtokens = prospect.apportionedMtokens - referrerMtokens

    // sanity check
    totalRewardedMsats += earnerMtokens + referrerMtokens
    if (totalRewardedMsats > totalMsats) {
      throw new Error('total rewarded msats exceeds total msats')
    }

    // apportion the earner's mtokens to the earns
    const apportionedEarns = apportionment(prospect.earns, earnerMtokens, 'typeProportion')

    const payOutCustodialTokenEarnings = [{
      payOutType: 'REWARD',
      userId: prospect.userId,
      mtokens: BigInt(earnerMtokens),
      custodialTokenType: 'SATS',
      earns: apportionedEarns.map(earn => ({
        userId: prospect.userId,
        msats: BigInt(earn.apportionedMtokens),
        type: earn.type,
        typeId: earn.typeId,
        typeProportion: earn.typeProportion,
        rank: earn.rank
      }))
    }]

    if (referrerId) {
      payOutCustodialTokenEarnings.push({
        payOutType: 'REWARD',
        userId: referrerId,
        mtokens: BigInt(referrerMtokens),
        custodialTokenType: 'SATS',
        earns: [{
          userId: referrerId,
          msats: BigInt(referrerMtokens),
          type: 'FOREVER_REFERRAL'
        }]
      })
    }

    payOutCustodialTokens.push(...payOutCustodialTokenEarnings)
  }

  return {
    payInType: 'REWARDS',
    mcost: BigInt(totalMsats),
    userId: USER_ID.rewards,
    payOutCustodialTokens
  }
}

export async function onPaidSideEffects (models, payInId) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { payOutCustodialTokens: { include: { earns: true } } } })

  const notifications = {}
  for (const payOutCustodialToken of payIn.payOutCustodialTokens) {
    const userN = notifications[payOutCustodialToken.userId] || {}
    const msats = payOutCustodialToken.mtokens + (userN.msats || 0n)
    for (const earn of payOutCustodialToken.earns) {
      const earnTypeMsats = earn.msats + (userN[earn.type]?.msats || 0n)
      const prevEarnTypeBestRank = userN[earn.type]?.bestRank
      const earnTypeBestRank = prevEarnTypeBestRank
        ? Math.min(prevEarnTypeBestRank, Number(earn.rank))
        : Number(earn.rank)
      notifications[payOutCustodialToken.userId] = {
        ...userN,
        msats,
        [earn.type]: {
          msats: earnTypeMsats,
          bestRank: earnTypeBestRank
        }
      }
    }
  }

  Promise.allSettled(
    Object.entries(notifications).map(([userId, earnings]) => notifyEarner(parseInt(userId, 10), earnings))
  ).catch(console.error)
}
