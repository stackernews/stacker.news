import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { numWithUnits, msatsToSats, satsToMsats } from '@/lib/format'
import { notifyBountyPaid } from '@/lib/webPush'
import { payOutBolt11Prospect } from '../lib/payOutBolt11'
import { getItemResult } from '../lib/item'
import { getRedistributedPayOutCustodialTokens } from '../lib/payOutCustodialTokens'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.P2P,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

// 100% of bounty to receiver via bolt11, +3% routing fee paid by payer
// no territory revenue, no rewards pool, no sybil fee
export async function getInitial (models, { id }, { me }) {
  const item = await models.item.findUnique({
    where: { id: parseInt(id) },
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
    throw new Error('bounty already paid to this item')
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
    itemPayIn: { itemId: parseInt(id) },
    payOutCustodialTokens,
    payOutBolt11
  }
}

export async function onBegin (tx, payInId, payInArgs) {
  const item = await getItemResult(tx, { id: payInArgs.id })
  const root = await tx.item.findUnique({ where: { id: item.rootId }, select: { bounty: true } })
  return { id: item.id, path: item.path, sats: root.bounty, act: 'TIP' }
}

export async function onRetry (tx, oldPayInId, newPayInId) {
  const { itemId } = await tx.itemPayIn.findUnique({ where: { payInId: oldPayInId } })
  const item = await getItemResult(tx, { id: itemId })
  const root = await tx.item.findUnique({ where: { id: item.rootId }, select: { bounty: true } })
  return { id: item.id, path: item.path, sats: root.bounty, act: 'TIP' }
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
    include: { itemPayIn: { include: { item: { include: { root: true } } } } }
  })
  const bounty = payIn.itemPayIn.item.root?.bounty ?? msatsToSats(payIn.mcost)
  const fee = Math.ceil(bounty * 3 / 100)
  return `SN: bounty ${numWithUnits(bounty, { abbreviate: false })} + ${numWithUnits(fee, { abbreviate: false })} proxy fee #${payIn.itemPayIn.itemId}`
}
