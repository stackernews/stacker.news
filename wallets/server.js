// import server side wallets
import * as lnd from '@/wallets/lnd/server'
import * as cln from '@/wallets/cln/server'
import * as lnAddr from '@/wallets/lightning-address/server'
import * as lnbits from '@/wallets/lnbits/server'
import * as nwc from '@/wallets/nwc/server'
import * as phoenixd from '@/wallets/phoenixd/server'
import * as blink from '@/wallets/blink/server'

// we import only the metadata of client side wallets
import * as lnc from '@/wallets/lnc'
import * as webln from '@/wallets/webln'

import { walletLogger } from '@/api/resolvers/wallet'
import walletDefs from '@/wallets/server'
import { parsePaymentRequest } from 'ln-service'
import { toPositiveBigInt, toPositiveNumber, formatMsats, formatSats, msatsToSats } from '@/lib/format'
import { PAID_ACTION_TERMINAL_STATES, WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { timeoutSignal, withTimeout } from '@/lib/time'
import { canReceive } from './common'
import wrapInvoice from './wrap'

export default [lnd, cln, lnAddr, lnbits, nwc, phoenixd, blink, lnc, webln]

const MAX_PENDING_INVOICES_PER_WALLET = 25

export async function createInvoice (userId, { msats, description, descriptionHash, expiry = 360 }, { predecessorId, models }) {
  // get the wallets in order of priority
  const wallets = await getInvoiceableWallets(userId, { predecessorId, models })

  msats = toPositiveNumber(msats)

  for (const { def, wallet } of wallets) {
    const logger = walletLogger({ wallet, models })

    try {
      logger.info(
        `↙ incoming payment: ${formatSats(msatsToSats(msats))}`,
        {
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

      return { invoice, wallet, logger }
    } catch (err) {
      logger.error(err.message, { status: true })
    }
  }

  throw new Error('no wallet to receive available')
}

export async function createWrappedInvoice (userId,
  { msats, feePercent, description, descriptionHash, expiry = 360 },
  { predecessorId, models, me, lnd }) {
  let logger, bolt11
  try {
    const { invoice, wallet } = await createInvoice(userId, {
      // this is the amount the stacker will receive, the other (feePercent)% is our fee
      msats: toPositiveBigInt(msats) * (100n - feePercent) / 100n,
      description,
      descriptionHash,
      expiry
    }, { predecessorId, models })

    logger = walletLogger({ wallet, models })
    bolt11 = invoice

    const { invoice: wrappedInvoice, maxFee } =
      await wrapInvoice({ bolt11, feePercent }, { msats, description, descriptionHash }, { me, lnd })

    return {
      invoice,
      wrappedInvoice: wrappedInvoice.request,
      wallet,
      maxFee
    }
  } catch (e) {
    logger?.error('invalid invoice: ' + e.message, { bolt11 })
    throw e
  }
}

export async function getInvoiceableWallets (userId, { predecessorId, models }) {
  // filter out all wallets that have already been tried by recursively following the retry chain of predecessor invoices.
  // the current predecessor invoice is in state 'FAILED' and not in state 'RETRYING' because we are currently retrying it
  // so it has not been updated yet.
  // if predecessorId is not provided, the subquery will be empty and thus no wallets are filtered out.
  const wallets = await models.$queryRaw`
    SELECT
      "Wallet".*,
      jsonb_build_object(
        'id', "users"."id",
        'hideInvoiceDesc', "users"."hideInvoiceDesc"
      ) AS "user"
    FROM "Wallet"
    JOIN "users" ON "users"."id" = "Wallet"."userId"
    WHERE
      "Wallet"."userId" = ${userId}
      AND "Wallet"."enabled" = true
      AND "Wallet"."id" NOT IN (
        WITH RECURSIVE "Retries" AS (
          -- select the current failed invoice that we are currently retrying
          -- this failed invoice will be used to start the recursion
          SELECT "Invoice"."id", "Invoice"."predecessorId"
          FROM "Invoice"
          WHERE "Invoice"."id" = ${predecessorId} AND "Invoice"."actionState" = 'FAILED'

          UNION ALL

          -- recursive part: use predecessorId to select the previous invoice that failed in the chain
          -- until there is no more previous invoice
          SELECT "Invoice"."id", "Invoice"."predecessorId"
          FROM "Invoice"
          JOIN "Retries" ON "Invoice"."id" = "Retries"."predecessorId"
          WHERE "Invoice"."actionState" = 'RETRYING'
        )
        SELECT
          "InvoiceForward"."walletId"
        FROM "Retries"
        JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Retries"."id"
        JOIN "Withdrawl" ON "Withdrawl".id = "InvoiceForward"."withdrawlId"
        WHERE "Withdrawl"."status" IS DISTINCT FROM 'CONFIRMED'
      )
    ORDER BY "Wallet"."priority" ASC, "Wallet"."id" ASC`

  const walletsWithDefs = wallets.map(wallet => {
    const w = walletDefs.find(w => w.walletType === wallet.type)
    return { wallet, def: w }
  })

  return walletsWithDefs.filter(({ def, wallet }) => canReceive({ def, config: wallet.wallet }))
}

async function walletCreateInvoice ({ wallet, def }, {
  msats,
  description,
  descriptionHash,
  expiry = 360
}, { logger, models }) {
  // check for pending withdrawals
  const pendingWithdrawals = await models.withdrawl.count({
    where: {
      walletId: wallet.id,
      status: null
    }
  })

  // and pending forwards
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
      wallet.wallet,
      {
        logger,
        signal: timeoutSignal(WALLET_CREATE_INVOICE_TIMEOUT_MS)
      }
    ), WALLET_CREATE_INVOICE_TIMEOUT_MS)
}
