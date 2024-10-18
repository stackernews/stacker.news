import * as lnd from 'wallets/lnd/server'
import * as cln from 'wallets/cln/server'
import * as lnAddr from 'wallets/lightning-address/server'
import * as lnbits from 'wallets/lnbits/server'
import * as nwc from 'wallets/nwc/server'
import * as phoenixd from 'wallets/phoenixd/server'
import { addWalletLog } from '@/api/resolvers/wallet'
import walletDefs from 'wallets/server'
import { parsePaymentRequest } from 'ln-service'
import { toPositiveNumber } from '@/lib/validate'
import { PAID_ACTION_TERMINAL_STATES } from '@/lib/constants'
import { withTimeout } from '@/lib/time'
import wrapInvoice from 'wallets/wrap'

export default [lnd, cln, lnAddr, lnbits, nwc, phoenixd]

const MAX_PENDING_INVOICES_PER_WALLET = 25

async function listWallets (models, userId) {
  return await models.wallet.findMany({
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
}

async function getWallet (models, userId, wallet) {
  const w = walletDefs.find(w => w.walletType === wallet.type)
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

  return { walletFull, walletField, createInvoice }
}

async function checkInvoice (models, wallet, invoice, msats) {
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
}

export async function createInvoice (userId, { msats, description, descriptionHash, expiry = 360 }, { models, walletOffset = 0 }) {
  // get the wallets in order of priority
  const wallets = await listWallets(models, userId)

  msats = toPositiveNumber(msats)

  for (let i = 0; i < wallets.length; i++) {
    const j = (walletOffset + i) % wallets.length
    const wallet = wallets[j]
    try {
      const { walletFull, walletField, createInvoice } = await getWallet(models, userId, wallet)
      const invoice = await withTimeout(
        createInvoice({
          msats,
          description: wallet.user.hideInvoiceDesc ? undefined : description,
          descriptionHash,
          expiry
        }, walletFull[walletField]), 10_000)
      await checkInvoice(models, wallet, invoice, msats)
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

export async function createWrappedInvoice (userId, { msats, wrappedMsats, description, descriptionHash, expiry = 360 }, { models, lnd, walletOffset = 0 }) {
  // get the wallets in order of priority
  const wallets = await listWallets(models, userId)
  msats = toPositiveNumber(msats)
  wrappedMsats = toPositiveNumber(wrappedMsats)
  for (let i = 0; i < wallets.length; i++) {
    const j = (walletOffset + i) % wallets.length
    const wallet = wallets[j]
    try {
      const { walletFull, walletField, createInvoice } = await getWallet(models, userId, wallet)
      const invoice = await withTimeout(
        createInvoice({
          msats,
          description: wallet.user.hideInvoiceDesc ? undefined : description,
          descriptionHash,
          expiry
        }, walletFull[walletField]), 10_000)
      await checkInvoice(models, wallet, invoice, msats)
      const { invoice: wrappedInvoice, maxFee } = await wrapInvoice(invoice, { msats: wrappedMsats, description }, { lnd })
      return { invoice, wallet, wrappedInvoice, maxFee }
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
