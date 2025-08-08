import { PAID_ACTION_PAYMENT_METHODS, PROXY_RECEIVE_FEE_PERCENT } from '@/lib/constants'
import { toPositiveBigInt, numWithUnits, msatsToSats } from '@/lib/format'
import { notifyDeposit } from '@/lib/webPush'
import { getInvoiceableWallets } from '@/wallets/server'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.P2P,
  PAID_ACTION_PAYMENT_METHODS.DIRECT
]

export async function getCost ({ msats }) {
  return toPositiveBigInt(msats)
}

export async function getInvoiceablePeer (_, { me, models, cost, paymentMethod }) {
  if (paymentMethod === PAID_ACTION_PAYMENT_METHODS.P2P && !me?.proxyReceive) return null

  // don't fallback to direct if proxy is enabled to always hide stacker's node pubkey
  if (paymentMethod === PAID_ACTION_PAYMENT_METHODS.DIRECT && me?.proxyReceive) return null

  const wallets = await getInvoiceableWallets(me.id, { models })
  if (wallets.length === 0) {
    return null
  }

  return me.id
}

export async function getSybilFeePercent () {
  return PROXY_RECEIVE_FEE_PERCENT
}

export async function perform ({
  invoiceId,
  comment,
  lud18Data,
  noteStr
}, { me, tx }) {
  return await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      comment,
      lud18Data,
      ...(noteStr ? { desc: noteStr } : {})
    },
    include: { invoiceForward: true }
  })
}

export async function describe ({ description }, { me, cost, paymentMethod, sybilFeePercent }) {
  const fee = paymentMethod === PAID_ACTION_PAYMENT_METHODS.P2P
    ? cost * BigInt(sybilFeePercent) / 100n
    : 0n
  return description ?? `SN: ${me?.name ?? ''} receives ${numWithUnits(msatsToSats(cost - fee))}`
}

export async function nonCriticalSideEffects ({ invoice }, { models }) {
  await notifyDeposit(invoice.userId, invoice)
  await models.$executeRaw`
    INSERT INTO pgboss.job (name, data)
    VALUES ('nip57', jsonb_build_object('hash', ${invoice.hash}))`
}
