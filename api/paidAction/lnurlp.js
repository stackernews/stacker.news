import { satsToMsats } from '@/lib/format'
import { notifyDeposit } from '@/lib/webPush'

export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = false
export const supportsFeeCredits = false

export async function getCost ({ sats }) {
  return satsToMsats(sats)
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

export async function perform ({ invoiceId, sats, description, descriptionHash, comment, targetUserId }, { me, tx }) {
  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      comment
    }
  })
  return { sats, targetUserId }
}

export async function describe ({ sats, description, descriptionHash }, context) {
  return `SN: ${description ?? ''}`
}

export async function onPaid ({ invoice }, { tx }) {
  const isP2P = !!invoice.invoiceForward
  if (isP2P) return
  const targetUserId = invoice.actionArgs?.targetUserId
  if (!targetUserId) throw new Error('No targetUserId')
  await notifyDeposit(targetUserId, invoice)
  await tx.user.update({
    where: { id: targetUserId },
    data: {
      msats: {
        increment: invoice.msatsReceived
      }
    }
  })
}
