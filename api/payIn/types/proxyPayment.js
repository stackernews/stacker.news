import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { toPositiveBigInt } from '@/lib/format'
import { notifyDeposit } from '@/lib/webPush'
import { payOutBolt11Prospect } from '../lib/payOutBolt11'
export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.P2P
]

// 3% to routing fee, 7% to rewards pool, 90% to invoice
export async function getInitial (models, { msats, description, descriptionHash, expiry }, { me }) {
  const mcost = toPositiveBigInt(msats)
  const routingFeeMtokens = mcost * 3n / 100n
  const rewardsPoolMtokens = mcost * 7n / 100n
  const proxyPaymentMtokens = mcost - routingFeeMtokens - rewardsPoolMtokens

  // payInBolt11 and payOutBolt11 belong to the same user
  const payOutBolt11 = await payOutBolt11Prospect(models, {
    msats: proxyPaymentMtokens,
    description: me.hideInvoiceDesc ? undefined : description,
    descriptionHash,
    expiry
  }, { payOutType: 'PROXY_PAYMENT', userId: me.id })

  return {
    payInType: 'PROXY_PAYMENT',
    userId: me.id,
    mcost,
    payOutCustodialTokens: [
      { payOutType: 'ROUTING_FEE', userId: null, mtokens: routingFeeMtokens, custodialTokenType: 'SATS' },
      { payOutType: 'REWARDS_POOL', userId: null, mtokens: rewardsPoolMtokens, custodialTokenType: 'SATS' }
    ],
    payOutBolt11
  }
}

// TODO: all of this needs to be updated elsewhere
export async function onBegin (tx, payInId, { comment, lud18Data, noteStr }, { me }) {
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
