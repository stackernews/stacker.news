import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC
]

export async function getInitial (models, { id }, { me }) {
  const pollOption = await models.pollOption.findUnique({
    where: { id: parseInt(id) },
    include: { item: { include: { sub: true } } }
  })

  const mcost = satsToMsats(pollOption.item.pollCost)
  const revenueMsats = mcost * BigInt(pollOption.item.sub.rewardsPct) / 100n
  const rewardMsats = mcost - revenueMsats

  return {
    payInType: 'POLL_VOTE',
    userId: me?.id,
    mcost,
    payOutCustodialTokens: [{
      payOutType: 'TERRITORY_REVENUE',
      userId: pollOption.item.sub.userId,
      mtokens: revenueMsats,
      custodialTokenType: 'SATS',
      subPayOutCustodialToken: {
        subName: pollOption.item.sub.name
      }
    }, {
      payOutType: 'REWARD_POOL',
      userId: null,
      mtokens: rewardMsats,
      custodialTokenType: 'SATS'
    }]
  }
}

export async function onBegin (tx, payInId, { id }, { me }) {
  const pollOption = await tx.pollOption.findUnique({
    where: { id: parseInt(id) }
  })
  const itemId = parseInt(pollOption.itemId)

  // the unique index on userId, itemId will prevent double voting
  await tx.pollBlindVote.create({ data: { userId: me.id, itemId, payInId } })
  await tx.pollVote.create({ data: { pollOptionId: pollOption.id, itemId, payInId } })

  return { id }
}

export async function onRetry (tx, oldPayInId, newPayInId) {
  await tx.itemAct.updateMany({ where: { payInId: oldPayInId }, data: { payInId: newPayInId } })
  await tx.pollBlindVote.updateMany({ where: { payInId: oldPayInId }, data: { payInId: newPayInId } })
  await tx.pollVote.updateMany({ where: { payInId: oldPayInId }, data: { payInId: newPayInId } })
}

export async function onPaid (tx, payInId) {
  // anonymize the vote
  await tx.pollVote.updateMany({ where: { payInId }, data: { payInId: null } })
}

export async function describe (models, payInId, { me }) {
  const pollOption = await models.pollOption.findUnique({ where: { payInId } })
  return `SN: vote on poll #${pollOption.itemId}`
}
