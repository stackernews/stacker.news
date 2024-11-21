import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { toPositiveBigInt } from '@/lib/validate'
import { notifyDeposit } from '@/lib/webPush'
import { numWithUnits, msatsToSats, satsToMsats } from '@/lib/format'
import { getInvoiceableWallets } from '@/wallets/server'
import { assertBelowBalanceLimit } from './lib/assert'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.P2P,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC
]

export async function getCost ({ msats }) {
  return toPositiveBigInt(msats)
}

export async function getInvoiceablePeer (_, { me, models, cost }) {
  if (!me?.proxyReceive) return null
  const wallets = await getInvoiceableWallets(me.id, { models })

  // if the user has any invoiceable wallets and this action will result in their balance
  // being greater than their desired threshold
  if (wallets.length > 0 && (cost + me.msats) > satsToMsats(me.autoWithdrawThreshold)) {
    return me.id
  }

  return null
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
  const invoice = await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      comment,
      lud18Data,
      ...(noteStr ? { desc: noteStr } : {})
    },
    include: { invoiceForward: true }
  })

  if (!invoice.invoiceForward) {
    // if the invoice is not p2p, assert that the user's balance limit is not exceeded
    await assertBelowBalanceLimit({ me, tx })
  }
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
      msats: {
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
