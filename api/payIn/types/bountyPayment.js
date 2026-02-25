import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { numWithUnits, msatsToSats, msatsToSatsDecimal, satsToMsats } from '@/lib/format'
import { notifyBountyPaid } from '@/lib/webPush'
import {
  BOUNTY_ALREADY_PAID_ERROR,
  BOUNTY_IN_PROGRESS_ERROR,
  BOUNTY_STALE_RETRY_ERROR,
  getBountyPaymentTail,
  getBountyTailBlockError
} from '../lib/bountyPayment'
import { payOutBolt11Prospect } from '../lib/payOutBolt11'
import { getItemResult } from '../lib/item'
import { getRedistributedPayOutCustodialTokens } from '../lib/payOutCustodialTokens'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.P2P,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC
]

// 100% of bounty to receiver via bolt11, +3% routing fee paid by payer
// no territory revenue, no rewards pool, no sybil fee
export async function getInitial (models, { id }, { me }) {
  const itemId = parseInt(id)

  const item = await models.item.findUnique({
    where: { id: itemId },
    include: { user: true }
  })

  if (!item) {
    throw new Error('item not found')
  }

  const root = await models.item.findUnique({
    where: { id: item.rootId }
  })

  if (!root || root.bounty === null) {
    throw new Error('item is not under a bounty post')
  }

  if (root.userId !== me.id) {
    throw new Error('only the bounty poster can pay the bounty')
  }

  if (root.bountyPaidTo?.includes(item.id)) {
    throw new Error(BOUNTY_ALREADY_PAID_ERROR)
  }

  const tail = await getBountyPaymentTail(models, itemId)
  const tailError = getBountyTailBlockError(tail)
  if (tailError) {
    throw new Error(tailError)
  }

  const bountyMsats = satsToMsats(root.bounty)
  const routingFeeMtokens = bountyMsats * 3n / 100n
  const mcost = bountyMsats + routingFeeMtokens

  // let this throw NoReceiveWalletError if receiver has no wallet -- no CC fallback
  const payOutBolt11 = await payOutBolt11Prospect(models, {
    msats: bountyMsats,
    description: `SN: bounty payment for #${item.id}`
  }, { userId: item.userId, payOutType: 'BOUNTY_PAYMENT' })

  const payOutCustodialTokens = getRedistributedPayOutCustodialTokens({
    mcost,
    payOutCustodialTokens: [
      { payOutType: 'ROUTING_FEE', userId: null, mtokens: routingFeeMtokens, custodialTokenType: 'SATS' }
    ],
    payOutBolt11
  })

  return {
    payInType: 'BOUNTY_PAYMENT',
    userId: me.id,
    mcost,
    itemPayIn: { itemId },
    payOutCustodialTokens,
    payOutBolt11
  }
}

export async function validateBeforeCreate (tx, payInProspect) {
  const itemId = payInProspect.itemPayIn?.itemId
  if (!itemId || payInProspect.genesisId) {
    return
  }
  const tail = await getBountyPaymentTail(tx, itemId)
  const tailError = getBountyTailBlockError(tail)
  if (tailError) {
    throw new Error(tailError)
  }
}

export async function validateRetry (models, payInFailedInitial) {
  const itemId = payInFailedInitial.itemPayIn?.itemId
  if (!itemId) {
    return
  }
  const tail = await getBountyPaymentTail(models, itemId)
  if (!tail) {
    throw new Error(BOUNTY_STALE_RETRY_ERROR)
  }
  if (tail.payInState === 'PAID') {
    throw new Error(BOUNTY_ALREADY_PAID_ERROR)
  }
  if (tail.payInState !== 'FAILED') {
    throw new Error(BOUNTY_IN_PROGRESS_ERROR)
  }
  if (tail.id !== payInFailedInitial.id) {
    throw new Error(BOUNTY_STALE_RETRY_ERROR)
  }
}

export async function onBegin (tx, payInId, payInArgs) {
  const item = await getItemResult(tx, { id: payInArgs.id })
  const { payOutBolt11 } = await tx.payIn.findUnique({ where: { id: payInId }, include: { payOutBolt11: true } })
  return { id: item.id, path: item.path, sats: msatsToSats(payOutBolt11.msats), act: 'TIP' }
}

export async function onRetry (tx, oldPayInId, newPayInId) {
  const { itemId, payIn } = await tx.itemPayIn.findUnique({
    where: { payInId: oldPayInId },
    include: { payIn: { include: { payOutBolt11: true } } }
  })
  const item = await getItemResult(tx, { id: itemId })
  return { id: item.id, path: item.path, sats: msatsToSats(payIn.payOutBolt11.msats), act: 'TIP' }
}

export async function onPaid (tx, payInId) {
  const payIn = await tx.payIn.findUnique({
    where: { id: payInId },
    include: {
      itemPayIn: { include: { item: true } }
    }
  })

  const item = payIn.itemPayIn.item

  // directly update bountyPaidTo on the root item
  await tx.$executeRaw`
    UPDATE "Item"
    SET "bountyPaidTo" = array_append(
      array_remove("bountyPaidTo", ${item.id}::INTEGER),
      ${item.id}::INTEGER
    )
    WHERE id = ${item.rootId}::INTEGER`
}

export async function onPaidSideEffects (models, payInId) {
  const payIn = await models.payIn.findUnique({
    where: { id: payInId },
    include: { itemPayIn: { include: { item: true } } }
  })
  notifyBountyPaid({ models, item: payIn.itemPayIn.item, payIn }).catch(console.error)
}

export async function describe (models, payInId) {
  const payIn = await models.payIn.findUnique({
    where: { id: payInId },
    include: { payOutBolt11: true, itemPayIn: true, payOutCustodialTokens: true }
  })
  const bounty = msatsToSats(payIn.payOutBolt11.msats)
  const routingFeeMsats = payIn.payOutCustodialTokens.find(t => t.payOutType === 'ROUTING_FEE')?.mtokens ??
    (payIn.mcost - payIn.payOutBolt11.msats)
  const fee = routingFeeMsats % 1000n === 0n
    ? numWithUnits(msatsToSats(routingFeeMsats), { abbreviate: false })
    : `${msatsToSatsDecimal(routingFeeMsats)} sats`

  return `SN: bounty ${numWithUnits(bounty, { abbreviate: false })} + ${fee} proxy fee #${payIn.itemPayIn.itemId}`
}
