import * as lnd from 'wallets/lnd/server'
import * as cln from 'wallets/cln/server'
import * as lnAddr from 'wallets/lightning-address/server'
import * as lnbits from 'wallets/lnbits/server'
import { addWalletLog } from '@/api/resolvers/wallet'
import walletDefs from 'wallets/server'
import { parsePaymentRequest } from 'ln-service'
import { toPositiveNumber } from '@/lib/validate'

export default [lnd, cln, lnAddr, lnbits]

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
        throw new Error(`invoice has incorrect amount ${bolt11.mtokens} !== ${msats}`)
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
