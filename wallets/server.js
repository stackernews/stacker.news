// import server side wallets
import * as lnd from '@/wallets/lnd/server'
import * as cln from '@/wallets/cln/server'
import * as lnAddr from '@/wallets/lightning-address/server'
import * as lnbits from '@/wallets/lnbits/server'
import * as nwc from '@/wallets/nwc/server'
import * as phoenixd from '@/wallets/phoenixd/server'
import * as blink from '@/wallets/blink/server'
import * as bolt12 from '@/wallets/bolt12/server'

// we import only the metadata of client side wallets
import * as lnc from '@/wallets/lnc'
import * as webln from '@/wallets/webln'

import { walletLogger } from '@/api/resolvers/wallet'
import walletDefs from '@/wallets/server'
import { isBolt12Offer, parseInvoice } from '@/lib/invoices'
import { toPositiveBigInt, toPositiveNumber, formatMsats, formatSats, msatsToSats } from '@/lib/format'
import { PAID_ACTION_TERMINAL_STATES } from '@/lib/constants'
import { withTimeout } from '@/lib/time'
import { canReceive } from './common'
import wrapInvoice from './wrap'
import { fetchBolt12InvoiceFromOffer } from '@/lib/lndk'

export default [lnd, cln, lnAddr, lnbits, nwc, phoenixd, blink, lnc, webln, bolt12]

const MAX_PENDING_INVOICES_PER_WALLET = 25

async function checkInvoice (invoice, { msats }, { lnd, logger }) {
  const parsedInvoice = await parseInvoice({ lnd, request: invoice })
  console.log('parsedInvoice', parsedInvoice)
  logger.info(`created invoice for ${formatSats(msatsToSats(parsedInvoice.mtokens))}`, {
    bolt11: invoice
  })
  if (BigInt(parsedInvoice.mtokens) !== BigInt(msats)) {
    if (BigInt(parsedInvoice.mtokens) > BigInt(msats)) {
      throw new Error('invoice invalid: amount too big')
    }
    if (BigInt(parsedInvoice.mtokens) === 0n) {
      throw new Error('invoice invalid: amount is 0 msats')
    }
    if (BigInt(msats) - BigInt(parsedInvoice.mtokens) >= 1000n) {
      throw new Error('invoice invalid: amount too small')
    }

    logger.warn('wallet does not support msats')
  }
}

export async function createInvoice (userId, { msats, description, descriptionHash, expiry = 360, supportBolt12 = true }, { predecessorId, models, lnd }) {
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
          { logger, models, lnd })
      } catch (err) {
        throw new Error('failed to create invoice: ' + err.message)
      }

      if (!isBolt12Offer(invoice)) {
        if (!supportBolt12) continue
        checkInvoice(invoice, { msats }, { lnd, logger })
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
  let logger, invoice, wallet
  try {
    const innerAmount = toPositiveBigInt(msats) * (100n - feePercent) / 100n
    ;({ invoice, wallet } = await createInvoice(userId, {
      // this is the amount the stacker will receive, the other (feePercent)% is our fee
      msats: innerAmount,
      description,
      descriptionHash,
      expiry
    }, { predecessorId, models, lnd }))

    logger = walletLogger({ wallet, models })

    // We need a bolt12 invoice to wrap, so we fetch one
    if (isBolt12Offer(invoice)) {
      invoice = await fetchBolt12InvoiceFromOffer({ lnd, offer: invoice, amount: innerAmount, description })
      checkInvoice(invoice, { msats: innerAmount }, { lnd, logger })
    }

    const { invoice: wrappedInvoice, maxFee } =
      await wrapInvoice(
        { bolt11: invoice, feePercent },
        { msats, description, descriptionHash },
        { me, lnd }
      )

    return {
      invoice,
      wrappedInvoice: wrappedInvoice.request,
      wallet,
      maxFee
    }
  } catch (e) {
    logger?.error('invalid invoice: ' + e.message, { bolt11: invoice })
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
}, { logger, models, lnd }) {
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
      { logger, lnd }
    ), 10_000)
}
