import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { toPositiveBigInt, numWithUnits, msatsToSats } from '@/lib/format'
import { notifyDeposit } from '@/lib/webPush'
import { createUserInvoice } from '@/wallets/server'
import { parsePaymentRequest } from 'ln-service'
export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.P2P
]

export async function getCost (models, { msats }, { me }) {
  return toPositiveBigInt(msats)
}

// 3% to routing fee, 7% to rewards pool, 90% to invoice
export async function getPayOuts (models, payIn, { msats }, { me }) {
  const routingFeeMtokens = msats * 3n / 100n
  const rewardsPoolMtokens = msats * 7n / 100n
  const proxyPaymentMtokens = msats - routingFeeMtokens - rewardsPoolMtokens

  const { invoice: bolt11, wallet } = await createUserInvoice(me.id, { msats: proxyPaymentMtokens }, { models })
  const invoice = await parsePaymentRequest({ request: bolt11 })

  return {
    payOutCustodialTokens: [
      { payOutType: 'ROUTING_FEE', userId: null, mtokens: routingFeeMtokens, custodialTokenType: 'SATS' },
      { payOutType: 'REWARDS_POOL', userId: null, mtokens: rewardsPoolMtokens, custodialTokenType: 'SATS' }
    ],
    payOutBolt11: {
      payOutType: 'PROXY_PAYMENT',
      hash: invoice.id,
      bolt11,
      msats: proxyPaymentMtokens,
      userId: me.id,
      walletId: wallet.id
    }
  }
}

// TODO: all of this needs to be updated elsewhere
export async function onPending (tx, payInId, { comment, lud18Data, noteStr }, { me }) {
  await tx.payInBolt11.update({
    where: { payInId },
    data: {
      lud18Data: {
        create: lud18Data
      },
      nostrNote: {
        create: {
          note: noteStr
        }
      },
      comment: {
        create: {
          comment
        }
      }
    }
  })
}

export async function onPaid (tx, payInId, { me }) {
  const payInBolt11 = await tx.payInBolt11.findUnique({ where: { payInId } })
  await tx.$executeRaw`
    INSERT INTO pgboss.job (name, data)
    VALUES ('nip57', jsonb_build_object('hash', ${payInBolt11.hash}))`
}

export async function nonCriticalSideEffects ({ invoice }, { models }) {
  await notifyDeposit(invoice.userId, invoice)
}

export async function describe (models, payInId, { me }) {
  const payInBolt11 = await models.payInBolt11.findUnique({
    where: { payInId },
    include: { lud18Data: true, nostrNote: true, comment: true, payIn: { include: { user: true } } }
  })
  const { nostrNote, payIn: { user }, msatsRequested } = payInBolt11
  return `SN: ${nostrNote ? 'zap' : 'pay'} ${user?.name ?? ''} ${numWithUnits(msatsToSats(msatsRequested))}`
}
