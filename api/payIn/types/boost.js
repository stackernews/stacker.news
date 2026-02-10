import { PAID_ACTION_PAYMENT_METHODS, RANK_HOT_SIGMA } from '@/lib/constants'
import { numWithUnits, msatsToSats, satsToMsats } from '@/lib/format'
import { getItemResult, getSubs } from '../lib/item'
import { getRedistributedPayOutCustodialTokens } from '../lib/payOutCustodialTokens'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC
]

export async function getInitial (models, { sats, id }, { me, subs }) {
  if (id && !subs) {
    const { subNames, parentId } = await models.item.findUnique({ where: { id: parseInt(id) } })
    subs = await getSubs(models, { subNames, parentId })
  }

  const mcost = satsToMsats(sats)
  const payOutCustodialTokens = getRedistributedPayOutCustodialTokens({ subs, mcost })

  // if we have a benefactor, we might not know the itemId until after the payIn is created
  // so we create the itemPayIn in onBegin
  return {
    payInType: 'BOOST',
    userId: me?.id,
    mcost,
    payOutCustodialTokens
  }
}

export async function onRetry (tx, oldPayInId, newPayInId) {
  const { itemId, payIn } = await tx.itemPayIn.findUnique({ where: { payInId: oldPayInId }, include: { payIn: true } })
  const item = await getItemResult(tx, { id: itemId })
  return { id: item.id, path: item.path, sats: msatsToSats(payIn.mcost), act: 'BOOST' }
}

export async function onBegin (tx, payInId, { sats, id }, benefactorResult) {
  id ??= benefactorResult.id

  if (!id) {
    throw new Error('item id is required')
  }

  const item = await getItemResult(tx, { id })
  await tx.payIn.update({ where: { id: payInId }, data: { itemPayIn: { create: { itemId: item.id } } } })

  return { id: item.id, path: item.path, sats, act: 'BOOST' }
}

export async function onPaid (tx, payInId) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId }, include: { itemPayIn: true } })

  const boostSats = msatsToSats(payIn.mcost)

  // increment boost on item
  await tx.item.update({
    where: { id: payIn.itemPayIn.itemId },
    data: {
      boost: { increment: boostSats }
    }
  })

  // accumulate rankhot: exp(t / sigma) * boost_sats
  await tx.$executeRaw`
    UPDATE "Item"
    SET rankhot = rankhot + EXP(EXTRACT(EPOCH FROM now()) / ${RANK_HOT_SIGMA}::DOUBLE PRECISION) * ${boostSats}::DOUBLE PRECISION
    WHERE id = ${payIn.itemPayIn.itemId}::INTEGER`

  await tx.$executeRaw`
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter, keepuntil)
    VALUES ('expireBoost', jsonb_build_object('id', ${payIn.itemPayIn.itemId}::INTEGER), 21, true,
              now() + interval '7 days', now() + interval '10 days')`
}

export async function describe (models, payInId) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { itemPayIn: true } })
  return `SN: boost #${payIn.itemPayIn.itemId} by ${numWithUnits(msatsToSats(payIn.mcost), { abbreviate: false })}`
}
