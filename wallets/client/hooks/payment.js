import { useCallback } from 'react'
import { sha256 } from '@noble/hashes/sha2.js'
import { WALLET_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import {
  AnonWalletError, WalletsNotAvailableError, WalletSenderError, WalletAggregateError, WalletPaymentAggregateError,
  WalletPaymentError, WalletError, WalletReceiverError, WalletSendStateNotReadyError,
  WalletPaymentRejectedError, WalletValidationError, WalletConfigurationError
} from '@/wallets/client/errors'
import { timeoutSignal } from '@/lib/time'
import { useMe } from '@/components/me'
import { formatSats, msatsToSats } from '@/lib/format'
import usePayInHelper from '@/components/payIn/hooks/use-pay-in-helper'
import { useWalletSendReady } from './global'
import { useWalletLoggerFactory } from './logger'
import { useSendProtocols } from './wallet'

export function useWalletPayment () {
  const protocols = useSendProtocols()
  const walletSendReady = useWalletSendReady()
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
      const paymentPromise = sendWalletPayment(protocol, latestPayIn.payerPrivates.payInBolt11, logger)
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

        if (!(paymentError instanceof WalletError)) {
          // payment failed for some reason unrelated to wallets (ie invoice expired or was canceled).
          // bail out of attempting wallets.
          logger.error(`payment failed: ${paymentErrorMessage(paymentError)}`)
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
          if (paymentError.settledUnknown) {
            logger.warn(`payment outcome unknown: ${paymentErrorMessage(paymentError)}`, { updateStatus: true })
          } else {
            logger.error(`payment failed: ${paymentErrorMessage(paymentError)}`, { updateStatus: true })
          }
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
  }, [protocols, walletSendReady, me, payInHelper, loggerFactory])
}

// payment is the minimal BOLT11 shape used by both PayIn rows and direct wallet sends.
// `requirePreimage` opts callers (direct sends) into throwing on missing/invalid
// preimage so the UI can surface "may still be in flight". The PayIn flow leaves it
// false because `controller.wait` polls server state and cancelling its invoice on
// every silent-success wallet would risk losing funds when the wallet really did pay.
export async function sendWalletPayment (protocol, payment, logger, { amountText, maxFee, timeout = WALLET_SEND_PAYMENT_TIMEOUT_MS, requirePreimage = false } = {}) {
  if (!payment.hash) throw new Error('sendWalletPayment requires payment.hash')

  const label = amountText ?? formatSats(msatsToSats(payment.msatsRequested))
  try {
    logger.info(`↗ sending payment: ${label}`)
    const preimage = await protocol.sendPayment(
      payment.bolt11,
      protocol.config,
      { signal: timeoutSignal(timeout), maxFee, timeout }
    )

    // some wallets like Coinos will always immediately return success without providing the preimage
    let proofIssue
    if (!preimage) proofIssue = 'wallet returned success without proof of payment'
    else if (!verifyPreimage(payment.hash, preimage)) proofIssue = 'wallet returned success with invalid proof of payment'

    if (proofIssue) {
      // direct sends have no server-side poll backstop; without proof the payment
      // may have settled, so throw — the catch below classifies it settled-unknown.
      if (requirePreimage) throw new Error(proofIssue)
      return logger.warn(proofIssue, { updateStatus: true })
    }
    logger.ok(`↗ payment sent: ${label}`, { updateStatus: true })
  } catch (err) {
    // we don't log the error here since callers decide whether to retry or surface it directly
    const message = err.message || err.toString?.()
    const error = new WalletSenderError(protocol.name, payment, message, { cause: err })
    // "definitively failed" needs proof: only a provider-reported rejection or a
    // pre-payment validation/configuration error is safe to retry — anything else
    // (transport errors, SDK throws, aborts) may have left the payment in flight.
    error.settledUnknown = !(err instanceof WalletPaymentRejectedError ||
      err instanceof WalletValidationError ||
      err instanceof WalletConfigurationError)
    throw error
  }
}

function verifyPreimage (hash, preimage) {
  const preimageHash = Buffer.from(sha256(Buffer.from(preimage, 'hex'))).toString('hex')
  return hash === preimageHash
}

export function paymentErrorMessage (err) {
  return err?.reason ?? err?.message ?? err?.toString?.() ?? 'unknown error'
}
