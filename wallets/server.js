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
import { toPositiveNumber, formatMsats, formatSats, msatsToSats } from '@/lib/format'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { timeoutSignal, withTimeout } from '@/lib/time'
import { canReceive } from './common'

export default [lnd, cln, lnAddr, lnbits, nwc, phoenixd, blink, lnc, webln]

const MAX_PENDING_INVOICES_PER_WALLET = 25

export async function createBolt11FromWallets (wallets, { msats, description, descriptionHash, expiry = 360 }, { models }) {
  msats = toPositiveNumber(msats)

  for (const { def, wallet } of walletsWithDefsReceiveable(wallets)) {
    const logger = walletLogger({ wallet, models })

    try {
      logger.info(
        `↙ incoming payment: ${formatSats(msatsToSats(msats))}`, {
          amount: formatMsats(msats)
        })

      let bolt11
      try {
        bolt11 = await createBolt11FromWallet(
          { wallet, def },
          { msats, description, descriptionHash, expiry },
          { logger, models })
      } catch (err) {
        throw new Error('failed to create invoice: ' + err.message)
      }

      const invoice = await parsePaymentRequest({ request: bolt11 })

      logger.info(`created invoice for ${formatSats(msatsToSats(invoice.mtokens))}`, {
        bolt11
      })

      if (BigInt(invoice.mtokens) !== BigInt(msats)) {
        if (BigInt(invoice.mtokens) > BigInt(msats)) {
          throw new Error('invoice invalid: amount too big')
        }
        if (BigInt(invoice.mtokens) === 0n) {
          throw new Error('invoice invalid: amount is 0 msats')
        }
        if (BigInt(msats) - BigInt(invoice.mtokens) >= 1000n) {
          throw new Error('invoice invalid: amount too small')
        }
      }

      // TODO: add option to check if wrap will succeed

      return { bolt11, wallet, logger }
    } catch (err) {
      console.error('failed to create user invoice:', err)
      logger.error(err.message, { status: true })
    }
  }
}

export async function walletsWithDefsReceiveable (wallets) {
  return wallets.map(wallet => {
    const w = walletDefs.find(w => w.walletType === wallet.type)
    return { wallet, def: w }
  }).filter(({ def, wallet }) => canReceive({ def, config: wallet.wallet }))
}

async function createBolt11FromWallet ({ wallet, def }, {
  msats,
  description,
  descriptionHash,
  expiry = 360
}, { logger, models }) {
  // check for pending payouts
  const pendingPayOutBolt11Count = await models.payOutBolt11.count({
    where: {
      walletId: wallet.id,
      status: null,
      payIn: {
        payInState: { notIn: ['PAID', 'FAILED'] }
      }
    }
  })

  if (pendingPayOutBolt11Count >= MAX_PENDING_INVOICES_PER_WALLET) {
    throw new Error(`too many pending invoices: has ${pendingPayOutBolt11Count}, max ${MAX_PENDING_INVOICES_PER_WALLET}`)
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
