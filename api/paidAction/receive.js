import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
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
  if (paymentMethod === PAID_ACTION_PAYMENT_METHODS.DIRECT && !me?.directReceive) return null

  const wallets = await getInvoiceableWallets(me.id, { models })
  if (wallets.length === 0) {
    return null
  }

  return me.id
}

export async function getSybilFeePercent () {
  return 10n
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

export async function onPaid ({ invoice }, { tx }) {
  if (!invoice) {
    throw new Error('invoice is required')
  }

  // P2P lnurlp does not need to update the user's balance
  if (invoice?.invoiceForward) return

  await tx.user.update({
    where: { id: invoice.userId },
    data: {
      mcredits: {
        increment: invoice.msatsReceived
      }
    }
  })
}

export async function nonCriticalSideEffects ({ invoice }, { models }) {
  await notifyDeposit(invoice.userId, invoice)
  await models.$executeRaw`
    INSERT INTO pgboss.job (name, data)
    VALUES ('nip57', jsonb_build_object('hash', ${invoice.hash}))`
}
