import * as lnd from 'wallets/lnd/server'
import * as cln from 'wallets/cln/server'
import * as lnAddr from 'wallets/lightning-address/server'
import { addWalletLog } from '@/api/resolvers/wallet'
import walletDefs from 'wallets/server'
import { parsePaymentRequest } from 'ln-service'

export default [lnd, cln, lnAddr]

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

  if (msats <= Number.MAX_SAFE_INTEGER) {
    msats = Number(msats)
  } else {
    throw new Error('msats is too large')
  }

  for (const wallet of wallets) {
    const w = walletDefs.find(w => w.walletType === wallet.type)
    try {
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

      const invoice = await createInvoice({
        msats,
        description: wallet.user.hideInvoiceDesc ? undefined : description,
        descriptionHash,
        expiry
      }, walletFull[walletField])

      const bolt11 = await parsePaymentRequest({ request: invoice })
      if (BigInt(bolt11.mtokens) !== BigInt(msats)) {
        throw new Error('invoice has incorrect amount')
      }

      return { invoice, wallet }
    } catch (error) {
      console.error(error)

      // TODO: I think this is a bug, `createInvoice` should parse the error

      // LND errors are in this shape: [code, type, { err: { code, details, metadata } }]
      const details = error[2]?.err?.details || error.message || error.toString?.()
      await addWalletLog({
        wallet,
        level: 'ERROR',
        message: `creating invoice for ${description ?? ''} failed: ` + details
      }, { me: wallet.user, models })
    }
  }

  throw new Error('no wallet available')
}
