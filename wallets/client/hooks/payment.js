import { useCallback } from 'react'
import { useSendProtocols, useWalletLoggerFactory } from '@/wallets/client/hooks'
import useInvoice from '@/components/use-invoice'
import { FAST_POLL_INTERVAL_MS, WALLET_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import {
  AnonWalletError, WalletsNotAvailableError, WalletSenderError, WalletAggregateError, WalletPaymentAggregateError,
  WalletPaymentError, WalletError, WalletReceiverError
} from '@/wallets/client/errors'
import { timeoutSignal, withTimeout } from '@/lib/time'
import { useMe } from '@/components/me'
import { formatSats } from '@/lib/format'

export function useWalletPayment () {
  const protocols = useSendProtocols()
  const sendPayment = useSendPayment()
  const invoiceHelper = useInvoice()
  const { me } = useMe()
  const loggerFactory = useWalletLoggerFactory()

  return useCallback(async (invoice, { waitFor, updateOnFallback } = {}) => {
    let aggregateError = new WalletAggregateError([])
    let latestInvoice = invoice

    // anon user cannot pay with wallets
    if (!me) {
      throw new AnonWalletError()
    }

    // throw a special error that caller can handle separately if no payment was attempted
    if (protocols.length === 0) {
      throw new WalletsNotAvailableError()
    }

    for (let i = 0; i < protocols.length; i++) {
      const protocol = protocols[i]
      const controller = invoiceController(latestInvoice, invoiceHelper.isInvoice)

      const logger = loggerFactory(protocol, latestInvoice)
      const paymentPromise = sendPayment(protocol, latestInvoice, logger)
      const pollPromise = controller.wait(waitFor)

      try {
        return await new Promise((resolve, reject) => {
          // can't await payments since we might pay hold invoices and thus payments might not settle immediately.
          // that's why we separately check if we received the payment with the invoice controller.
          paymentPromise.catch(reject)
          pollPromise.then(resolve).catch(reject)
        })
      } catch (err) {
        let paymentError = err
        const message = `payment failed: ${paymentError.reason ?? paymentError.message}`

        if (!(paymentError instanceof WalletError)) {
          // payment failed for some reason unrelated to wallets (ie invoice expired or was canceled).
          // bail out of attempting wallets.
          logger.error(message)
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
          logger.info('failed to forward payment to receiver, retrying with new invoice')
          i -= 1
        } else if (paymentError instanceof WalletPaymentError) {
          // only log payment errors, not configuration errors
          logger.error(message)
        }

        if (paymentError instanceof WalletPaymentError) {
          // if a payment was attempted, cancel invoice to make sure it cannot be paid later and create new invoice to retry.
          await invoiceHelper.cancel(latestInvoice)
        }

        // only create a new invoice if we will try to pay with a protocol again
        const retry = paymentError instanceof WalletReceiverError || i < protocols.length - 1
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
  }, [protocols, invoiceHelper, sendPayment])
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
      }, FAST_POLL_INTERVAL_MS)

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
  return useCallback(async (protocol, invoice, logger) => {
    try {
      logger.info(`↗ sending payment: ${formatSats(invoice.satsRequested)}`)
      const preimage = await withTimeout(
        protocol.sendPayment(
          invoice.bolt11,
          protocol.config,
          { signal: timeoutSignal(WALLET_SEND_PAYMENT_TIMEOUT_MS) }
        ),
        WALLET_SEND_PAYMENT_TIMEOUT_MS)

      // some wallets like Coinos will always immediately return success without providing the preimage
      if (preimage) {
        logger.ok(`↗ payment sent: ${formatSats(invoice.satsRequested)}`)
      } else {
        logger.warn('wallet returned success without proof of payment')
      }
    } catch (err) {
      // we don't log the error here since we want to handle receiver errors separately
      const message = err.message || err.toString?.()
      throw new WalletSenderError(protocol.name, invoice, message)
    }
  }, [])
}
