import { useCallback } from 'react'
import { sha256 } from '@noble/hashes/sha2.js'
import { WALLET_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import {
  AnonWalletError, WalletsNotAvailableError, WalletSenderError, WalletAggregateError, WalletPaymentAggregateError,
  WalletPaymentError, WalletError, WalletReceiverError, WalletSendStateNotReadyError
} from '@/wallets/client/errors'
import { timeoutSignal, withTimeout } from '@/lib/time'
import { useMe } from '@/components/me'
import { formatSats, msatsToSats } from '@/lib/format'
import usePayInHelper from '@/components/payIn/hooks/use-pay-in-helper'
import { useWalletSendReady } from './global'
import { useWalletLoggerFactory } from './logger'
import { useSendProtocols } from './wallet'

export function useWalletPayment () {
  const protocols = useSendProtocols()
  const walletSendReady = useWalletSendReady()
  const sendPayment = useSendPayment()
  const payInHelper = usePayInHelper()
  const { me } = useMe()
  const loggerFactory = useWalletLoggerFactory()

  return useCallback(async (payIn, { waitFor, protocolLimit = protocols.length } = {}) => {
    let aggregateError = new WalletAggregateError([])
    let latestPayIn = payIn
    const attempts = Math.min(protocolLimit, protocols.length)

    // anon user cannot pay with wallets
    if (!me) {
      throw new AnonWalletError()
    }

    if (!walletSendReady) {
      throw new WalletSendStateNotReadyError()
    }

    // throw a special error that caller can handle separately if no payment was attempted
    if (protocols.length === 0) {
      throw new WalletsNotAvailableError()
    }

    for (let i = 0; i < attempts; i++) {
      const protocol = protocols[i]
      const controller = payInHelper.waitCheckController(latestPayIn.id)

      const logger = loggerFactory(protocol, latestPayIn)
      const paymentPromise = sendPayment(protocol, latestPayIn.payerPrivates.payInBolt11, logger)
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
          await payInHelper.check(latestPayIn.id, waitFor)
        } catch (err) {
          if (err instanceof WalletError) {
            paymentError = err
          }
        }

        if (paymentError instanceof WalletReceiverError) {
          // if payment failed because of the receiver, use the same wallet again
          // and log this as info, not error
          logger.info('couldn\'t deliver the payment to the recipient wallet, retrying with a new invoice')
          i -= 1
        } else if (paymentError instanceof WalletPaymentError) {
          // only log payment errors, not configuration errors
          logger.error(message, { updateStatus: true })
        }

        if (paymentError instanceof WalletPaymentError) {
          // if a payment was attempted, cancel invoice to make sure it cannot be paid later and create new invoice to retry.
          await payInHelper.cancel(latestPayIn)
        }

        // only create a new invoice if we will try to pay with a protocol again
        const retry = paymentError instanceof WalletReceiverError || i < attempts - 1
        if (retry) {
          const retryProtocol = paymentError instanceof WalletReceiverError ? protocol : protocols[i + 1]
          latestPayIn = await payInHelper.retry(latestPayIn, { sendProtocolId: Number(retryProtocol.id) })
        }

        aggregateError = new WalletAggregateError([aggregateError, paymentError], latestPayIn)

        continue
      } finally {
        controller.stop()
      }
    }

    // if we reach this line, no wallet payment succeeded
    throw new WalletPaymentAggregateError([aggregateError], latestPayIn)
  }, [protocols, walletSendReady, me, payInHelper, sendPayment, loggerFactory])
}

function useSendPayment () {
  return useCallback(async (protocol, payInBolt11, logger) => {
    try {
      logger.info(`↗ sending payment: ${formatSats(msatsToSats(payInBolt11.msatsRequested))}`)
      const preimage = await withTimeout(
        protocol.sendPayment(
          payInBolt11.bolt11,
          protocol.config,
          { signal: timeoutSignal(WALLET_SEND_PAYMENT_TIMEOUT_MS) }
        ),
        WALLET_SEND_PAYMENT_TIMEOUT_MS)

      // some wallets like Coinos will always immediately return success without providing the preimage
      if (!preimage) {
        return logger.warn('wallet returned success without proof of payment', { updateStatus: true })
      }
      if (!verifyPreimage(payInBolt11.hash, preimage)) {
        return logger.warn('wallet returned success with invalid proof of payment', { updateStatus: true })
      }
      logger.ok(`↗ payment sent: ${formatSats(msatsToSats(payInBolt11.msatsRequested))}`, { updateStatus: true })
    } catch (err) {
      // we don't log the error here since we want to handle receiver errors separately
      const message = err.message || err.toString?.()
      throw new WalletSenderError(protocol.name, payInBolt11, message)
    }
  }, [])
}

function verifyPreimage (hash, preimage) {
  const preimageHash = Buffer.from(sha256(Buffer.from(preimage, 'hex'))).toString('hex')
  return hash === preimageHash
}
