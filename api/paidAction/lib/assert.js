import { BALANCE_LIMIT_MSATS, PAID_ACTION_TERMINAL_STATES, USER_ID, SN_ADMIN_IDS } from '@/lib/constants'
import { msatsToSats, numWithUnits } from '@/lib/format'
import { datePivot } from '@/lib/time'

const MAX_PENDING_PAID_ACTIONS_PER_USER = 100
const MAX_PENDING_DIRECT_INVOICES_PER_USER_MINUTES = 10
const MAX_PENDING_DIRECT_INVOICES_PER_USER = 100
const USER_IDS_BALANCE_NO_LIMIT = [...SN_ADMIN_IDS, USER_ID.anon, USER_ID.ad]

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

export async function assertBelowBalanceLimit (context) {
  const { me, tx } = context
  if (!me || USER_IDS_BALANCE_NO_LIMIT.includes(me.id)) return

  // we need to prevent this invoice (and any other pending invoices and withdrawls)
  // from causing the user's balance to exceed the balance limit
  const pendingInvoices = await tx.invoice.aggregate({
    where: {
      userId: me.id,
      // p2p invoices are never in state PENDING
      actionState: 'PENDING',
      actionType: 'RECEIVE'
    },
    _sum: {
      msatsRequested: true
    }
  })

  // Get pending withdrawals total
  const pendingWithdrawals = await tx.withdrawl.aggregate({
    where: {
      userId: me.id,
      status: null
    },
    _sum: {
      msatsPaying: true,
      msatsFeePaying: true
    }
  })

  // Calculate total pending amount
  const pendingMsats = (pendingInvoices._sum.msatsRequested ?? 0n) +
    ((pendingWithdrawals._sum.msatsPaying ?? 0n) + (pendingWithdrawals._sum.msatsFeePaying ?? 0n))

  // Check balance limit
  if (pendingMsats + me.msats > BALANCE_LIMIT_MSATS) {
    throw new Error(
      `pending invoices and withdrawals must not cause balance to exceed ${
        numWithUnits(msatsToSats(BALANCE_LIMIT_MSATS))
      }`
    )
  }
}
