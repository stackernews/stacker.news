import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { satsToMsats } from '@/lib/format'
import { getRedistributedPayOutCustodialTokens } from '../lib/payOutCustodialTokens'
import { GqlInputError } from '@/lib/error'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getInitial (models, { id }, { me }) {
  const pollOption = await models.pollOption.findUnique({
    where: { id: parseInt(id) },
    include: { item: { include: { sub: true } } }
  })

  const mcost = satsToMsats(pollOption.item.pollCost)
  const payOutCustodialTokens = getRedistributedPayOutCustodialTokens({ sub: pollOption.item.sub, mcost })

  return {
    payInType: 'POLL_VOTE',
    userId: me?.id,
    mcost,
    payOutCustodialTokens,
    pollVote: {
      pollOptionId: pollOption.id,
      itemId: pollOption.itemId
    },
    itemPayIn: {
      itemId: pollOption.itemId
    }
  }
}

export async function onBegin (tx, payInId, { id }) {
  const { userId } = await tx.payIn.findUnique({ where: { id: payInId } })
  // XXX this is only a sufficient check because of the row locks we
  // take for payIns that might race with this one
  const meVoted = await tx.payIn.findFirst({
    where: {
      userId,
      id: { not: payInId },
      payInType: 'POLL_VOTE',
      payInState: { in: ['PAID', 'PENDING', 'PENDING_HELD'] },
      itemPayIn: {
        item: {
          pollOptions: {
            some: {
              id: Number(id)
            }
          }
        }
      }
    }
  })
  if (meVoted) {
    throw new GqlInputError('already voted')
  }
  // anonymize the vote
  await tx.pollVote.updateMany({ where: { payInId }, data: { payInId: null } })
  return { id }
}

export async function describe (models, payInId) {
  const pollVote = await models.pollVote.findUnique({ where: { payInId } })
  return `SN: vote on poll #${pollVote.itemId}`
}
