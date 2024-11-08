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

import { addWalletLog } from '@/api/resolvers/wallet'
import walletDefs from 'wallets/server'
import { parsePaymentRequest } from 'ln-service'
import { toPositiveNumber } from '@/lib/validate'
import { PAID_ACTION_TERMINAL_STATES } from '@/lib/constants'
import { withTimeout } from '@/lib/time'
import { canReceive } from './common'

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
    try {
      if (!canReceive({ def: w, config: wallet.wallet })) {
        continue
      }

      const { walletType, walletField, createInvoice } = w

      const walletFull = await models.wallet.findFirst({
        where: {
          userId,
          type: walletType
        },
        include: {
          [walletField]: true
        }
      })

      if (!walletFull || !walletFull[walletField]) {
        throw new Error(`no ${walletType} wallet found`)
      }

      // check for pending withdrawals
      const pendingWithdrawals = await models.withdrawl.count({
        where: {
          walletId: walletFull.id,
          status: null
        }
      })

      // and pending forwards
      const pendingForwards = await models.invoiceForward.count({
        where: {
          walletId: walletFull.id,
          invoice: {
            actionState: {
              notIn: PAID_ACTION_TERMINAL_STATES
            }
          }
        }
      })

      console.log('pending invoices', pendingWithdrawals + pendingForwards)
      if (pendingWithdrawals + pendingForwards >= MAX_PENDING_INVOICES_PER_WALLET) {
        throw new Error('wallet has too many pending invoices')
      }
      console.log('use wallet', walletType)

      const invoice = await withTimeout(
        createInvoice({
          msats,
          description: wallet.user.hideInvoiceDesc ? undefined : description,
          descriptionHash,
          expiry
        }, walletFull[walletField]), 10_000)

      const bolt11 = await parsePaymentRequest({ request: invoice })
      if (BigInt(bolt11.mtokens) !== BigInt(msats)) {
        if (BigInt(bolt11.mtokens) > BigInt(msats)) {
          throw new Error(`invoice is for an amount greater than requested ${bolt11.mtokens} > ${msats}`)
        }
        if (BigInt(bolt11.mtokens) === 0n) {
          throw new Error('invoice is for 0 msats')
        }
        if (BigInt(msats) - BigInt(bolt11.mtokens) >= 1000n) {
          throw new Error(`invoice has a different satoshi amount ${bolt11.mtokens} !== ${msats}`)
        }

        await addWalletLog({
          wallet,
          level: 'INFO',
          message: `wallet does not support msats so we floored ${msats} msats to nearest sat ${BigInt(bolt11.mtokens)} msats`
        }, { models })
      }

      return { invoice, wallet }
    } catch (error) {
      console.error(error)
      await addWalletLog({
        wallet,
        level: 'ERROR',
        message: `creating invoice for ${description ?? ''} failed: ` + error
      }, { models })
    }
  }

  throw new Error('no wallet available')
}
