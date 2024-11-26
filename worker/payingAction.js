import { getPaymentFailureStatus, getPaymentOrNotSent } from '@/api/lnd'
import { walletLogger } from '@/api/resolvers/wallet'
import { formatMsats, formatSats, msatsToSats } from '@/lib/format'
import { datePivot } from '@/lib/time'
import { toPositiveBigInt, toPositiveNumber } from '@/lib/validate'
import { notifyWithdrawal } from '@/lib/webPush'
import { Prisma } from '@prisma/client'

async function transitionWithdrawal (jobName,
  { withdrawalId, toStatus, transition, withdrawal, onUnexpectedError },
  { models, lnd, boss }
) {
  console.group(`${jobName}: transitioning withdrawal ${withdrawalId} from null to ${toStatus}`)

  let dbWithdrawal
  try {
    const currentDbWithdrawal = await models.withdrawl.findUnique({ where: { id: withdrawalId } })
    console.log('withdrawal has status', currentDbWithdrawal.status)

    if (currentDbWithdrawal.status) {
      console.log('withdrawal is already has a terminal status, skipping transition')
      return
    }

    const { hash, createdAt } = currentDbWithdrawal
    const lndWithdrawal = withdrawal ?? await getPaymentOrNotSent({ id: hash, lnd, createdAt })

    const transitionedWithdrawal = await models.$transaction(async tx => {
      // grab optimistic concurrency lock and the invoice
      dbWithdrawal = await tx.withdrawl.update({
        include: {
          wallet: true
        },
        where: {
          id: withdrawalId,
          status: null
        },
        data: {
          status: toStatus
        }
      })

      // our own optimistic concurrency check
      if (!dbWithdrawal) {
        console.log('record not found in our own concurrency check, assuming concurrent worker transitioned it')
        return
      }

      const data = await transition({ lndWithdrawal, dbWithdrawal, tx })
      if (data) {
        return await tx.withdrawl.update({
          include: {
            wallet: true
          },
          where: { id: dbWithdrawal.id },
          data
        })
      }

      return dbWithdrawal
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      // we only need to do this because we settleHodlInvoice inside the transaction
      // ... and it's prone to timing out
      timeout: 60000
    })

    if (transitionedWithdrawal) {
      console.log('transition succeeded')
      return transitionedWithdrawal
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        console.log('record not found, assuming concurrent worker transitioned it')
        return
      }
      if (e.code === 'P2034') {
        console.log('write conflict, assuming concurrent worker is transitioning it')
        return
      }
    }

    console.error('unexpected error', e)
    onUnexpectedError?.({ error: e, dbWithdrawal, models, boss })
    await boss.send(
      jobName,
      { withdrawalId },
      { startAfter: datePivot(new Date(), { seconds: 30 }), priority: 1000 })
  } finally {
    console.groupEnd()
  }
}

export async function payingActionConfirmed ({ data: args, models, lnd, boss }) {
  const transitionedWithdrawal = await transitionWithdrawal('payingActionConfirmed', {
    toStatus: 'CONFIRMED',
    ...args,
    transition: async ({ dbWithdrawal, lndWithdrawal, tx }) => {
      const msatsFeePaid = toPositiveBigInt(lndWithdrawal.payment.fee_mtokens)
      const msatsPaid = toPositiveBigInt(lndWithdrawal.payment.mtokens) - msatsFeePaid

      await tx.user.update({
        where: { id: dbWithdrawal.userId },
        data: { msats: { increment: dbWithdrawal.msatsFeePaying - msatsFeePaid } }
      })

      return {
        msatsFeePaid,
        msatsPaid,
        preimage: lndWithdrawal.payment.secret
      }
    }
  }, { models, lnd, boss })

  if (transitionedWithdrawal) {
    await notifyWithdrawal(transitionedWithdrawal)

    const logger = walletLogger({ models, wallet: transitionedWithdrawal.wallet })
    logger?.ok(
      `↙ payment received: ${formatSats(msatsToSats(transitionedWithdrawal.msatsPaid))}`,
      {
        bolt11: transitionedWithdrawal.bolt11,
        preimage: transitionedWithdrawal.preimage,
        fee: formatMsats(transitionedWithdrawal.msatsFeePaid)
      })
  }
}

export async function payingActionFailed ({ data: args, models, lnd, boss }) {
  let message
  const transitionedWithdrawal = await transitionWithdrawal('payingActionFailed', {
    toStatus: 'UNKNOWN_FAILURE',
    ...args,
    transition: async ({ dbWithdrawal, lndWithdrawal, tx }) => {
      await tx.user.update({
        where: { id: dbWithdrawal.userId },
        data: { msats: { increment: dbWithdrawal.msatsFeePaying + dbWithdrawal.msatsPaying } }
      })

      // update to particular status
      const { status, message: failureMessage } = getPaymentFailureStatus(lndWithdrawal)
      message = failureMessage
      return {
        status
      }
    }
  }, { models, lnd, boss })

  if (transitionedWithdrawal) {
    const logger = walletLogger({ models, wallet: transitionedWithdrawal.wallet })
    logger?.error(
      `incoming payment failed: ${message}`,
      {
        bolt11: transitionedWithdrawal.bolt11,
        max_fee: formatMsats(toPositiveNumber(transitionedWithdrawal.msatsFeePaying))
      })
  }
}
