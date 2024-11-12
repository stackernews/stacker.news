import { toPositiveBigInt } from '@/lib/validate'
import { notifyDeposit } from '@/lib/webPush'

export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = false
export const supportsFeeCredits = false

export async function getCost ({ msats }) {
  return toPositiveBigInt(msats)
}

export async function getInvoiceablePeer ({ targetUserId }, { models }) {
  const user = await models.user.findUnique({
    where: { id: targetUserId }
  })
  return user?.lnurlpP2P ? targetUserId : null
}

export async function getSybilFeePercent () {
  return 10n
}

export async function perform ({
  invoiceId,
  msats,
  comment,
  targetUserId,
  lud18Data
}, { me, tx }) {
  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      comment,
      lud18Data
    }
  })
  return { msats, targetUserId }
}

export async function describe ({ description }, context) {
  return `SN: ${description ?? ''}`
}

export async function onPaid ({ invoice, targetUserId }, { tx }) {
  // P2P lnurlp does not need to update the user's balance
  if (invoice?.invoiceForward) return

  if (!targetUserId) {
    throw new Error('No targetUserId')
  }

  await tx.user.update({
    where: { id: targetUserId },
    data: {
      msats: {
        increment: invoice.msatsReceived
      }
    }
  })
}

export async function nonCriticalSideEffects ({ invoice, targetUserId }) {
  await notifyDeposit(targetUserId, invoice)
}
