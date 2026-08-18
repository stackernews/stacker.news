import { PAID_ACTION_PAYMENT_METHODS, PROXY_RECEIVE_FEE_PERCENT } from '@/lib/constants'
import { toPositiveBigInt } from '@/lib/format'
import { notifyDeposit } from '@/lib/webPush'
import { payOutBolt11Prospect } from '../lib/payOutBolt11'
import { getRedistributedPayOutCustodialTokens } from '../lib/payOutCustodialTokens'
export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.P2P
]

export async function getInitial (models, { msats, description, descriptionHash, expiry, walletId }, { me }) {
  const mcost = toPositiveBigInt(msats)
  const proxyPaymentMtokens = mcost * (100n - PROXY_RECEIVE_FEE_PERCENT) / 100n
  const routingFeeMtokens = mcost - proxyPaymentMtokens

  // payInBolt11 and payOutBolt11 belong to the same user
  const payOutBolt11 = await payOutBolt11Prospect(models, {
    msats: proxyPaymentMtokens,
    description,
    descriptionHash,
    expiry
  }, { payOutType: 'PROXY_PAYMENT', userId: me.id, walletId })

  const payOutCustodialTokens = getRedistributedPayOutCustodialTokens({
    sub: null,
    mcost,
    payOutCustodialTokens: [
      { payOutType: 'ROUTING_FEE', userId: null, mtokens: routingFeeMtokens, custodialTokenType: 'SATS' }
    ],
    payOutBolt11
  })

  return {
    payInType: 'PROXY_PAYMENT',
    userId: me.id,
    mcost,
    payOutCustodialTokens,
    payOutBolt11
  }
}

export async function onBegin (tx, payInId, { comment, descriptionHashPreimage, lud18Data, note }) {
  if (note && typeof descriptionHashPreimage !== 'string') {
    throw new Error('NIP-57 request is missing its description hash preimage')
  }

  const data = {
    ...(lud18Data && { lud18Data: { create: lud18Data } }),
    ...(note && { nostrNote: { create: { note, rawRequest: descriptionHashPreimage } } }),
    ...(comment && { comment: { create: { comment } } })
  }

  if (Object.keys(data).length === 0) {
    return
  }

  await tx.payInBolt11.update({
    where: { payInId },
    data
  })
}

export async function onPaid (tx, payInId) {
  const payInBolt11 = await tx.payInBolt11.findUnique({ where: { payInId } })
  await tx.$executeRaw`
    INSERT INTO pgboss.job (name, data)
    VALUES ('nip57', jsonb_build_object('hash', ${payInBolt11.hash}))`
}

export async function onPaidSideEffects (models, payInId) {
  const payInBolt11 = await models.payInBolt11.findUnique({ where: { payInId } })
  await notifyDeposit(payInBolt11.userId, payInBolt11)
}

export async function describe (models, payInId) {
  const { user } = await models.payIn.findUnique({
    where: { id: payInId },
    include: { user: true }
  })
  return `pay ${user.name}@stacker.news`
}
