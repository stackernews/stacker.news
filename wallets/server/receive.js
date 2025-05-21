import { parsePaymentRequest } from 'ln-service'
import { toPositiveBigInt, toPositiveNumber, formatMsats, formatSats, msatsToSats } from '@/lib/format'
import { PAID_ACTION_TERMINAL_STATES, WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { timeoutSignal, withTimeout } from '@/lib/time'
import { wrapInvoice } from '@/wallets/server/wrap'
import { walletLogger } from '@/wallets/server/logger'

// TODO(wallet-v2): implement this
const walletDefs = [] // [lnd, cln, lnAddr, lnbits, nwc, phoenixd, blink, lnc, webln]
export default walletDefs

const MAX_PENDING_INVOICES_PER_WALLET = 25

export async function * createUserInvoice (userId, { msats, description, descriptionHash, expiry = 360 }, { paymentAttempt, predecessorId, models }) {
  // get the wallets in order of priority
  const wallets = await getInvoiceableWallets(userId, {
    paymentAttempt,
    predecessorId,
    models
  })

  msats = toPositiveNumber(msats)

  for (const { def, wallet } of wallets) {
    const logger = walletLogger({ wallet, models })

    try {
      logger.info(
        `↙ incoming payment: ${formatSats(msatsToSats(msats))}`, {
          amount: formatMsats(msats)
        })

      let invoice
      try {
        invoice = await walletCreateInvoice(
          { wallet, def },
          { msats, description, descriptionHash, expiry },
          { logger, models })
      } catch (err) {
        throw new Error('failed to create invoice: ' + err.message)
      }

      const bolt11 = await parsePaymentRequest({ request: invoice })

      logger.info(`created invoice for ${formatSats(msatsToSats(bolt11.mtokens))}`, {
        bolt11: invoice
      })

      if (BigInt(bolt11.mtokens) !== BigInt(msats)) {
        if (BigInt(bolt11.mtokens) > BigInt(msats)) {
          throw new Error('invoice invalid: amount too big')
        }
        if (BigInt(bolt11.mtokens) === 0n) {
          throw new Error('invoice invalid: amount is 0 msats')
        }
        if (BigInt(msats) - BigInt(bolt11.mtokens) >= 1000n) {
          throw new Error('invoice invalid: amount too small')
        }
      }

      yield { invoice, wallet, logger }
    } catch (err) {
      console.error('failed to create user invoice:', err)
      logger.error(err.message, { status: true })
    }
  }
}

export async function createWrappedInvoice (userId,
  { msats, feePercent, description, descriptionHash, expiry = 360 },
  { paymentAttempt, predecessorId, models, me, lnd }) {
  // loop over all receiver wallet invoices until we successfully wrapped one
  for await (const { invoice, logger, wallet } of createUserInvoice(userId, {
    // this is the amount the stacker will receive, the other (feePercent)% is our fee
    msats: toPositiveBigInt(msats) * (100n - feePercent) / 100n,
    description,
    descriptionHash,
    expiry
  }, { paymentAttempt, predecessorId, models })) {
    let bolt11
    try {
      bolt11 = invoice
      const { invoice: wrappedInvoice, maxFee } = await wrapInvoice({ bolt11, feePercent }, { msats, description, descriptionHash }, { me, lnd })
      return {
        invoice,
        wrappedInvoice: wrappedInvoice.request,
        wallet,
        maxFee
      }
    } catch (e) {
      console.error('failed to wrap invoice:', e)
      logger?.error('failed to wrap invoice: ' + e.message, { bolt11 })
    }
  }

  throw new Error('no wallet to receive available')
}

// TODO(wallet-v2): update this for wallet schema v2
export async function getInvoiceableWallets (userId, { paymentAttempt, predecessorId, models }) {
  // filter out all wallets that have already been tried by recursively following the retry chain of predecessor invoices.
  // the current predecessor invoice is in state 'FAILED' and not in state 'RETRYING' because we are currently retrying it
  // so it has not been updated yet.
  // if predecessorId is not provided, the subquery will be empty and thus no wallets are filtered out.
  // const wallets = await models.$queryRaw`
  //   SELECT
  //     "Wallet".*,
  //     jsonb_build_object(
  //       'id', "users"."id",
  //       'hideInvoiceDesc', "users"."hideInvoiceDesc"
  //     ) AS "user"
  //   FROM "Wallet"
  //   JOIN "users" ON "users"."id" = "Wallet"."userId"
  //   WHERE
  //     "Wallet"."userId" = ${userId}
  //     AND "Wallet"."enabled" = true
  //     AND "Wallet"."id" NOT IN (
  //       WITH RECURSIVE "Retries" AS (
  //         -- select the current failed invoice that we are currently retrying
  //         -- this failed invoice will be used to start the recursion
  //         SELECT "Invoice"."id", "Invoice"."predecessorId"
  //         FROM "Invoice"
  //         WHERE "Invoice"."id" = ${predecessorId} AND "Invoice"."actionState" = 'FAILED'
  //
  //         UNION ALL
  //
  //         -- recursive part: use predecessorId to select the previous invoice that failed in the chain
  //         -- until there is no more previous invoice
  //         SELECT "Invoice"."id", "Invoice"."predecessorId"
  //         FROM "Invoice"
  //         JOIN "Retries" ON "Invoice"."id" = "Retries"."predecessorId"
  //         WHERE "Invoice"."actionState" = 'RETRYING'
  //         AND "Invoice"."paymentAttempt" = ${paymentAttempt}
  //       )
  //       SELECT
  //         "InvoiceForward"."walletId"
  //       FROM "Retries"
  //       JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Retries"."id"
  //       JOIN "Withdrawl" ON "Withdrawl".id = "InvoiceForward"."withdrawlId"
  //       WHERE "Withdrawl"."status" IS DISTINCT FROM 'CONFIRMED'
  //     )
  //   ORDER BY "Wallet"."priority" ASC, "Wallet"."id" ASC`
  //
  // const walletsWithDefs = wallets.map(wallet => {
  //   const w = walletDefs.find(w => w.walletType === wallet.type)
  //   return { wallet, def: w }
  // })
  //
  // return walletsWithDefs.filter(({ def, wallet }) => canReceive({ def, config: wallet.wallet }))
  return []
}

async function walletCreateInvoice ({ wallet, def }, {
  msats,
  description,
  descriptionHash,
  expiry = 360
}, { logger, models }) {
  // check for pending withdrawals

  // TODO(wallet-v2): make sure this still works as intended
  const pendingWithdrawals = await models.withdrawl.count({
    where: {
      walletId: wallet.id,
      status: null
    }
  })

  // and pending forwards
  // TODO(wallet-v2): make sure this still works as intended
  const pendingForwards = await models.invoiceForward.count({
    where: {
      walletId: wallet.id,
      invoice: {
        actionState: {
          notIn: PAID_ACTION_TERMINAL_STATES
        }
      }
    }
  })

  const pending = pendingWithdrawals + pendingForwards
  if (pendingWithdrawals + pendingForwards >= MAX_PENDING_INVOICES_PER_WALLET) {
    throw new Error(`too many pending invoices: has ${pending}, max ${MAX_PENDING_INVOICES_PER_WALLET}`)
  }

  return await withTimeout(
    def.createInvoice(
      {
        msats,
        description: wallet.user.hideInvoiceDesc ? undefined : description,
        descriptionHash,
        expiry
      },
      // TODO(wallet-v2): this will probably need an update
      wallet.wallet,
      {
        logger,
        signal: timeoutSignal(WALLET_CREATE_INVOICE_TIMEOUT_MS)
      }
    ), WALLET_CREATE_INVOICE_TIMEOUT_MS)
}
