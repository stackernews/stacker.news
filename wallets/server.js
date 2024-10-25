// import server side wallets
import * as lnd from 'wallets/lnd/server'
import * as cln from 'wallets/cln/server'
import * as lnAddr from 'wallets/lightning-address/server'
import * as lnbits from 'wallets/lnbits/server'
import * as nwc from 'wallets/nwc/server'
import * as phoenixd from 'wallets/phoenixd/server'
import * as blink from 'wallets/blink/server'

// we import only the metadata of client side wallets
import * as lnc from 'wallets/lnc'
import * as webln from 'wallets/webln'

import { walletLogger } from '@/api/resolvers/wallet'
import walletDefs from 'wallets/server'
import { parsePaymentRequest } from 'ln-service'
import { toPositiveNumber } from '@/lib/validate'
import { PAID_ACTION_TERMINAL_STATES } from '@/lib/constants'
import { withTimeout } from '@/lib/time'
import { canReceive } from './common'
import { formatMsats } from '@/lib/format'

export default [lnd, cln, lnAddr, lnbits, nwc, phoenixd, blink, lnc, webln]

const MAX_PENDING_INVOICES_PER_WALLET = 25

export async function createInvoice (userId, { msats, description, descriptionHash, expiry = 360 }, { models }) {
  // get the wallets in order of priority
  const wallets = await models.wallet.findMany({
    where: { userId, enabled: true },
    include: {
      user: true
    },
    orderBy: [
      { priority: 'asc' },
      // use id as tie breaker (older wallet first)
      { id: 'asc' }
    ]
  })

  msats = toPositiveNumber(msats)

  for (const wallet of wallets) {
    const w = walletDefs.find(w => w.walletType === wallet.type)

    const config = wallet.wallet
    if (!canReceive({ def: w, config })) {
      continue
    }

    const logger = walletLogger({ wallet, models })

    try {
      await logger.info(`↙ incoming payment: ${formatMsats(msats)}`)

      let invoice
      try {
        invoice = await walletCreateInvoice(
          { msats, description, descriptionHash, expiry },
          { ...w, userId, createInvoice: w.createInvoice },
          { logger, models })
      } catch (err) {
        throw new Error('failed to create invoice: ' + err.message)
      }

      const bolt11 = await parsePaymentRequest({ request: invoice })

      await logger.info(`created invoice for ${formatMsats(bolt11.mtokens)}`)

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

        await logger.warn('wallet does not support msats')
      }

      return { invoice, wallet, logger }
    } catch (err) {
      await logger.error(err.message)
    }
  }

  throw new Error('no wallet to receive available')
}

async function walletCreateInvoice (
  {
    msats,
    description,
    descriptionHash,
    expiry = 360
  },
  {
    userId,
    walletType,
    walletField,
    createInvoice
  },
  { logger, models }) {
  const wallet = await models.wallet.findFirst({
    where: {
      userId,
      type: walletType
    },
    include: {
      [walletField]: true,
      user: true
    }
  })

  const config = wallet[walletField]

  if (!wallet || !config) {
    throw new Error('wallet not found')
  }

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
    createInvoice(
      {
        msats,
        description: wallet.user.hideInvoiceDesc ? undefined : description,
        descriptionHash,
        expiry
      },
      config,
      { logger }
    ), 10_000)
}
