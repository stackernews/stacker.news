import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { notifyEarner } from '@/lib/webPush'

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS
]

export const systemOnly = true

export async function getInitial (models, { totalMsats, rewardProspects }) {
  const payOutCustodialTokens = []

  // add in referral earnings
  // compute the payOutCustodialTokens with their Earn row relations
  let totalRewardedMsats = 0
  console.log('rewardProspects', rewardProspects.reduce((acc, prospect) => acc + prospect.total_proportion, 0),
    rewardProspects.reduce((acc, prospect) => acc + prospect.total_proportion * totalMsats, 0))
  for (const rewardProspect of rewardProspects) {
    const prospectMsats = rewardProspect.total_proportion * totalMsats

    const foreverReferrerEarnings = Math.floor(parseFloat(prospectMsats * 0.1)) // 10% of earnings
    const oneDayReferrerEarnings = Math.floor(parseFloat(prospectMsats * 0.1)) // 10% of earnings
    const earnerEarnings = Math.floor(parseFloat(prospectMsats)) - foreverReferrerEarnings - oneDayReferrerEarnings

    // sanity check
    totalRewardedMsats += earnerEarnings + foreverReferrerEarnings + oneDayReferrerEarnings
    if (totalRewardedMsats > totalMsats) {
      throw new Error('total rewarded msats exceeds total msats')
    }

    console.log('earnerEarnings', earnerEarnings)
    console.log('foreverReferrerEarnings', foreverReferrerEarnings)
    console.log('oneDayReferrerEarnings', oneDayReferrerEarnings)
    console.log('totalRewardedMsats', totalRewardedMsats)
    console.log('totalMsats', totalMsats)

    const payOutCustodialTokenEarnings = [{
      payOutType: 'REWARD',
      userId: rewardProspect.userId,
      mtokens: BigInt(earnerEarnings),
      custodialTokenType: 'SATS',
      earns: rewardProspect.earns.map(earn => ({
        userId: rewardProspect.userId,
        msats: Math.floor(totalMsats * earn.typeProportion * 0.8),
        typeProportion: earn.typeProportion,
        type: earn.type,
        typeId: earn.typeId,
        rank: earn.rank
      }))
    }, {
      payOutType: 'REWARD',
      userId: rewardProspect.foreverReferrerId,
      mtokens: BigInt(foreverReferrerEarnings),
      custodialTokenType: 'SATS',
      earns: [{
        userId: rewardProspect.foreverReferrerId,
        msats: foreverReferrerEarnings,
        type: 'FOREVER_REFERRAL'
      }]
    }, {
      payOutType: 'REWARD',
      userId: rewardProspect.oneDayReferrerId,
      mtokens: BigInt(oneDayReferrerEarnings),
      custodialTokenType: 'SATS',
      earns: [{
        userId: rewardProspect.oneDayReferrerId,
        msats: oneDayReferrerEarnings,
        type: 'ONE_DAY_REFERRAL'
      }]
    }]

    payOutCustodialTokens.push(...payOutCustodialTokenEarnings)
  }

  return {
    payInType: 'REWARDS',
    mcost: BigInt(totalMsats),
    payOutCustodialTokens
  }
}

export async function onPaidSideEffects (models, payInId) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { payOutCustodialTokens: { include: { earns: true } } } })

  const notifications = {}
  for (const payOutCustodialToken of payIn.payOutCustodialTokens) {
    const userN = notifications[payOutCustodialToken.userId] || {}
    const msats = payOutCustodialToken.mtokens + (userN.msats || 0)
    for (const earn of payOutCustodialToken.earns) {
      const earnTypeMsats = earn.msats + (userN[earn.type]?.msats || 0)
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
