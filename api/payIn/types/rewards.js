import { notifyEarner } from '@/lib/webPush'

export async function getInitial (models, { totalMsats, rewardProspects }) {
  const payOutCustodialTokens = []

  // add in referral earnings
  // compute the payOutCustodialTokens with their Earn row relations
  let totalRewardedMsats = 0
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

    const payOutCustodialTokenEarnings = [{
      payOutType: 'REWARD',
      userId: rewardProspect.userId,
      mtokens: earnerEarnings,
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
      mtokens: foreverReferrerEarnings,
      custodialTokenType: 'SATS',
      earns: [{
        userId: rewardProspect.foreverReferrerId,
        msats: foreverReferrerEarnings,
        type: 'FOREVER_REFERRAL'
      }]
    }, {
      payOutType: 'REWARD',
      userId: rewardProspect.oneDayReferrerId,
      mtokens: oneDayReferrerEarnings,
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
    mcost: totalMsats,
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
