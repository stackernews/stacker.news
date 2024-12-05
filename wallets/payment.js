import { useCallback } from 'react'
import { useSendWallets } from '@/wallets'
import { formatSats } from '@/lib/format'
import useInvoice from '@/components/use-invoice'
import { FAST_POLL_INTERVAL } from '@/lib/constants'
import {
  WalletsNotAvailableError, WalletSenderError, WalletAggregateError, WalletPaymentAggregateError,
  WalletNotEnabledError, WalletSendNotConfiguredError, WalletPaymentError, WalletError
} from '@/wallets/errors'
import { canSend } from './common'
import { useWalletLoggerFactory } from './logger'

export function useWalletPayment () {
  const wallets = useSendWallets()
  const sendPayment = useSendPayment()
  const invoiceHelper = useInvoice()

  return useCallback(async (invoice, { waitFor, updateOnFallback }) => {
    let aggregateError = new WalletAggregateError([])
    let latestInvoice = invoice

    // throw a special error that caller can handle separately if no payment was attempted
    if (wallets.length === 0) {
      throw new WalletsNotAvailableError()
    }

    for (const [i, wallet] of wallets.entries()) {
      const controller = invoiceController(latestInvoice, invoiceHelper.isInvoice)
      try {
        return await new Promise((resolve, reject) => {
          // can't await wallet payments since we might pay hold invoices and thus payments might not settle immediately.
          // that's why we separately check if we received the payment with the invoice controller.
          sendPayment(wallet, latestInvoice).catch(reject)
          controller.wait(waitFor)
            .then(resolve)
            .catch(reject)
        })
      } catch (err) {
        // cancel invoice to make sure it cannot be paid later and create new invoice to retry.
        // we only need to do this if payment was attempted which is not the case if the wallet is not enabled.
        if (err instanceof WalletPaymentError) {
          await invoiceHelper.cancel(latestInvoice)

          // is there another wallet to try?
          const lastAttempt = i === wallets.length - 1
          if (!lastAttempt) {
            latestInvoice = await invoiceHelper.retry(latestInvoice, { update: updateOnFallback })
          }
        }

        // TODO: receiver fallbacks
        //
        // if payment failed because of the receiver, we should use the same wallet again.
        // if (err instanceof ReceiverError) { ... }

        // try next wallet if the payment failed because of the wallet
        // and not because it expired or was canceled
        if (err instanceof WalletError) {
          aggregateError = new WalletAggregateError([aggregateError, err], latestInvoice)
          continue
        }

        // payment failed not because of the sender or receiver wallet. bail out of attemping wallets.
        throw err
      } finally {
        controller.stop()
      }
    }

    // if we reach this line, no wallet payment succeeded
    throw new WalletPaymentAggregateError([aggregateError], latestInvoice)
  }, [wallets, invoiceHelper, sendPayment])
}

function invoiceController (inv, isInvoice) {
  const controller = new AbortController()
  const signal = controller.signal
  controller.wait = async (waitFor = inv => inv?.actionState === 'PAID') => {
    return await new Promise((resolve, reject) => {
      let updatedInvoice, paid
      const interval = setInterval(async () => {
        try {
          ({ invoice: updatedInvoice, check: paid } = await isInvoice(inv, waitFor))
          if (paid) {
            resolve(updatedInvoice)
            clearInterval(interval)
            signal.removeEventListener('abort', abort)
          } else {
            console.info(`invoice #${inv.id}: waiting for payment ...`)
          }
        } catch (err) {
          reject(err)
          clearInterval(interval)
          signal.removeEventListener('abort', abort)
        }
      }, FAST_POLL_INTERVAL)

      const abort = () => {
        console.info(`invoice #${inv.id}: stopped waiting`)
        resolve(updatedInvoice)
        clearInterval(interval)
        signal.removeEventListener('abort', abort)
      }
      signal.addEventListener('abort', abort)
    })
  }

  controller.stop = () => controller.abort()

  return controller
}

function useSendPayment () {
  const factory = useWalletLoggerFactory()

  return useCallback(async (wallet, invoice) => {
    const logger = factory(wallet)

    if (!wallet.config.enabled) {
      throw new WalletNotEnabledError(wallet.def.name)
    }

    if (!canSend(wallet)) {
      throw new WalletSendNotConfiguredError(wallet.def.name)
    }

    const { bolt11, satsRequested } = invoice

    logger.info(`↗ sending payment: ${formatSats(satsRequested)}`, { bolt11 })
    try {
      const preimage = await wallet.def.sendPayment(bolt11, wallet.config, { logger })
      logger.ok(`↗ payment sent: ${formatSats(satsRequested)}`, { bolt11, preimage })
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error(`payment failed: ${message}`, { bolt11 })
      throw new WalletSenderError(wallet.def.name, invoice, message)
    }
  }, [factory])
}
