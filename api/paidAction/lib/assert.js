import { PAID_ACTION_TERMINAL_STATES, USER_ID } from '@/lib/constants'
import { datePivot } from '@/lib/time'

const MAX_PENDING_PAID_ACTIONS_PER_USER = 100
const MAX_PENDING_DIRECT_INVOICES_PER_USER_MINUTES = 10
const MAX_PENDING_DIRECT_INVOICES_PER_USER = 100

export async function assertBelowMaxPendingInvoices (context) {
  const { models, me } = context
  const pendingInvoices = await models.invoice.count({
    where: {
      userId: me?.id ?? USER_ID.anon,
      actionState: {
        notIn: PAID_ACTION_TERMINAL_STATES
      }
    }
  })

  if (pendingInvoices >= MAX_PENDING_PAID_ACTIONS_PER_USER) {
    throw new Error('You have too many pending paid actions, cancel some or wait for them to expire')
  }
}

export async function assertBelowMaxPendingDirectPayments (userId, context) {
  const { models, me } = context

  if (me?.id !== userId) {
    const pendingSenderInvoices = await models.directPayment.count({
      where: {
        senderId: me?.id ?? USER_ID.anon,
        createdAt: {
          gt: datePivot(new Date(), { minutes: -MAX_PENDING_DIRECT_INVOICES_PER_USER_MINUTES })
        }
      }
    })

    if (pendingSenderInvoices >= MAX_PENDING_DIRECT_INVOICES_PER_USER) {
      throw new Error('You\'ve sent too many direct payments')
    }
  }

  if (!userId) return

  const pendingReceiverInvoices = await models.directPayment.count({
    where: {
      receiverId: userId,
      createdAt: {
        gt: datePivot(new Date(), { minutes: -MAX_PENDING_DIRECT_INVOICES_PER_USER_MINUTES })
      }
    }
  })

  if (pendingReceiverInvoices >= MAX_PENDING_DIRECT_INVOICES_PER_USER) {
    throw new Error('Receiver has too many direct payments')
  }
}
