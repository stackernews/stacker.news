import { toPositiveBigInt } from '@/lib/validate'
import { notifyDeposit } from '@/lib/webPush'

export const anonable = false
export const supportsPessimism = true
export const supportsOptimism = false
export const supportsFeeCredits = false

export async function getCost ({ msats }) {
  return toPositiveBigInt(msats)
}

export async function getInvoiceablePeer (_, { models, me }) {
  const user = await models.user.findUnique({
    where: { id: me.id }
  })

  return user?.lnurlpP2P ? me.id : null
}

export async function getSybilFeePercent () {
  return 10n
}

export async function perform ({
  invoiceId,
  msats,
  comment,
  lud18Data
}, { me, tx }) {
  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      comment,
      lud18Data
    }
  })
}

export async function describe ({ description }) {
  return description ?? 'SN: lnurlp'
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

export async function nonCriticalSideEffects ({ invoice }) {
  await notifyDeposit(invoice.userId, invoice)
}
