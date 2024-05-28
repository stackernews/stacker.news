import { Wallet } from '@/lib/constants'
import { addWalletLog } from '../resolvers/wallet'
import createInvoiceLND from './lnd-macaroon'
import createInvoiceCLN from './cln'
import createInvoiceLNAddr from './lnaddr'
import { parsePaymentRequest } from 'ln-service'

export default async function createUserInvoice ({ userId, msats, description, descriptionHash, expiry = 360 }, { models }) {
  // get the wallets in order of priority
  const wallets = await models.wallet.findMany({
    where: { userId },
    orderBy: { priority: 'desc' },
    include: {
      walletLightningAddress: true,
      walletLND: true,
      walletCLN: true
    }
  })

  for (const wallet of wallets) {
    let invoice
    try {
      if (wallet.type === Wallet.LND.type) {
        invoice = await createInvoiceLND(wallet.walletLND, { msats, description, descriptionHash, expiry })
      } else if (wallet.type === Wallet.CLN.type) {
        invoice = await createInvoiceCLN(wallet.walletCLN, { msats, description, descriptionHash, expiry })
      } else if (wallet.type === Wallet.LnAddr.type) {
        invoice = await createInvoiceLNAddr(wallet.walletLightningAddress, { msats, description, descriptionHash, expiry })
      }

      const bolt11 = await parsePaymentRequest({ request: invoice })
      if (BigInt(bolt11.mtokens) !== BigInt(msats)) {
        throw new Error('invoice has incorrect amount')
      }

      return { invoice, wallet }
    } catch (error) {
      console.error(error)
      // LND errors are in this shape: [code, type, { err: { code, details, metadata } }]
      const details = error[2]?.err?.details || error.message || error.toString?.()
      await addWalletLog({
        wallet,
        level: 'ERROR',
        message: 'failed to get invoice: ' + details
      }, { me: { id: userId }, models })
    }
  }

  throw new Error('no wallet available')
}
