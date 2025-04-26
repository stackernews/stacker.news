import { datePivot } from '@/lib/time'
import { createHodlInvoice, createInvoice, parsePaymentRequest } from 'ln-service'
import lnd from '@/api/lnd'
import { wrapBolt11 } from '@/wallets/server'
import { payInTypeModules } from '../types'
import { PAY_IN_INCLUDE } from './payInCreate'

const INVOICE_EXPIRE_SECS = 600

function payInBolt11FromBolt11 (bolt11) {
  const decodedBolt11 = parsePaymentRequest({ request: bolt11 })
  const expiresAt = new Date(decodedBolt11.expires_at)
  const msatsRequested = BigInt(decodedBolt11.mtokens)
  return {
    hash: decodedBolt11.id,
    bolt11,
    msatsRequested,
    expiresAt
  }
}

// TODO: throw errors that give us PayInFailureReason
export async function payInCreatePayInBolt11 (models, { mCostRemaining, payIn }, { me }) {
  const createLNDinvoice = payIn.pessimisticEnv ? createHodlInvoice : createInvoice
  const expiresAt = datePivot(new Date(), { seconds: INVOICE_EXPIRE_SECS })
  const invoice = await createLNDinvoice({
    description: payIn.user?.hideInvoiceDesc ? undefined : await payInTypeModules[payIn.payInType].describe(models, payIn.id, { me }),
    mtokens: String(mCostRemaining),
    expires_at: expiresAt,
    lnd
  })

  const payInBolt11 = payInBolt11FromBolt11(invoice.request)
  return await models.payIn.update({
    where: { id: payIn.id },
    data: {
      payInState: payIn.pessimisticEnv ? 'PENDING_HELD' : 'PENDING',
      payInStateChangedAt: new Date(),
      payInBolt11: { create: payInBolt11 }
    },
    include: PAY_IN_INCLUDE
  })
}

export async function payInCreatePayInBolt11Wrap (models, { mCostRemaining, payIn }, { me }) {
  const bolt11 = await wrapBolt11({ msats: mCostRemaining, bolt11: payIn.payOutBolt11.bolt11, expiry: INVOICE_EXPIRE_SECS }, { models, me })
  const payInBolt11 = payInBolt11FromBolt11(bolt11)
  return models.payIn.update({
    where: { id: payIn.id },
    data: {
      payInState: 'PENDING_HELD',
      payInStateChangedAt: new Date(),
      payInBolt11: { create: payInBolt11 },
      include: PAY_IN_INCLUDE
    }
  })
}
