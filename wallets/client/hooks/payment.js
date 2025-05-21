import { useCallback } from 'react'
import { useSendWallets } from '@/wallets/client/hooks'
import { formatSats } from '@/lib/format'
import useInvoice from '@/components/use-invoice'
import { FAST_POLL_INTERVAL, WALLET_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import {
  AnonWalletError, WalletsNotAvailableError, WalletSenderError, WalletAggregateError, WalletPaymentAggregateError,
  WalletNotEnabledError, /* WalletSendNotConfiguredError, */ WalletPaymentError, WalletError, WalletReceiverError
} from '@/wallets/client/errors'
import { timeoutSignal, withTimeout } from '@/lib/time'
import { useMe } from '@/components/me'

export function useWalletPayment () {
  const wallets = useSendWallets()
  const sendPayment = useSendPayment()
  const invoiceHelper = useInvoice()
  const { me } = useMe()

  return useCallback(async (invoice, { waitFor, updateOnFallback } = {}) => {
    let aggregateError = new WalletAggregateError([])
    let latestInvoice = invoice

    // anon user cannot pay with wallets
    if (!me) {
      throw new AnonWalletError()
    }

    // throw a special error that caller can handle separately if no payment was attempted
    if (wallets.length === 0) {
      throw new WalletsNotAvailableError()
    }

    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i]

      const controller = invoiceController(latestInvoice, invoiceHelper.isInvoice)

      const walletPromise = sendPayment(wallet, latestInvoice)
      const pollPromise = controller.wait(waitFor)

      try {
        return await new Promise((resolve, reject) => {
          // can't await wallet payments since we might pay hold invoices and thus payments might not settle immediately.
          // that's why we separately check if we received the payment with the invoice controller.
          walletPromise.catch(reject)
          pollPromise.then(resolve).catch(reject)
        })
      } catch (err) {
        let paymentError = err
        // TODO(wallet-v2): I removed the wallet logger on the client. Make sure this is still logged on the server.
        // const message = `payment failed: ${paymentError.reason ?? paymentError.message}`

        if (!(paymentError instanceof WalletError)) {
          // payment failed for some reason unrelated to wallets (ie invoice expired or was canceled).
          // bail out of attempting wallets.
          // TODO(wallet-v2): I removed the wallet logger on the client. Make sure the payment error is still logged on the server.
          throw paymentError
        }

        // at this point, paymentError is always a wallet error,
        // we just need to distinguish between receiver and sender errors

        try {
          // we need to poll one more time to check for failed forwards since sender wallet errors
          // can be caused by them which we want to handle as receiver errors, not sender errors.
          await invoiceHelper.isInvoice(latestInvoice, waitFor)
        } catch (err) {
          if (err instanceof WalletError) {
            paymentError = err
          }
        }

        if (paymentError instanceof WalletReceiverError) {
          // if payment failed because of the receiver, use the same wallet again
          // and log this as info, not error
          // TODO(wallet-v2): I removed the wallet logger on the client. Make sure this is still logged on the server.
          // logger.info('failed to forward payment to receiver, retrying with new invoice', { bolt11 })
          i -= 1
        } else if (paymentError instanceof WalletPaymentError) {
          // only log payment errors, not configuration errors
          // TODO(wallet-v2): I removed the wallet logger on the client. Make sure this is still logged on the server.
          // logger.error(message, { bolt11 })
        }

        if (paymentError instanceof WalletPaymentError) {
          // if a payment was attempted, cancel invoice to make sure it cannot be paid later and create new invoice to retry.
          await invoiceHelper.cancel(latestInvoice)
        }

        // only create a new invoice if we will try to pay with a wallet again
        const retry = paymentError instanceof WalletReceiverError || i < wallets.length - 1
        if (retry) {
          latestInvoice = await invoiceHelper.retry(latestInvoice, { update: updateOnFallback })
        }

        aggregateError = new WalletAggregateError([aggregateError, paymentError], latestInvoice)

        continue
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
  // TODO(wallet-v2): this will probably need an update
  return useCallback(async (wallet, logger, invoice) => {
    if (!wallet.config.enabled) {
      throw new WalletNotEnabledError(wallet.def.name)
    }

    // TODO(wallet-v2): implement this
    // if (!canSend(wallet)) {
    //   throw new WalletSendNotConfiguredError(wallet.def.name)
    // }

    const { bolt11, satsRequested } = invoice

    logger.info(`↗ sending payment: ${formatSats(satsRequested)}`, { bolt11 })
    try {
      const preimage = await withTimeout(
        wallet.def.sendPayment(bolt11, wallet.config, {
          logger,
          signal: timeoutSignal(WALLET_SEND_PAYMENT_TIMEOUT_MS)
        }),
        WALLET_SEND_PAYMENT_TIMEOUT_MS)
      logger.ok(`↗ payment sent: ${formatSats(satsRequested)}`, { bolt11, preimage })
    } catch (err) {
      // we don't log the error here since we want to handle receiver errors separately
      const message = err.message || err.toString?.()
      throw new WalletSenderError(wallet.def.name, invoice, message)
    }
  }, [])
}
