import { useCallback, useMemo } from 'react'
import { useWallets } from '@/wallets'
import walletDefs from '@/wallets/client'
import { formatSats } from '@/lib/format'
import { useWalletLogger } from '@/components/wallet-logger'
import { useInvoice } from '@/components/payment'
import { FAST_POLL_INTERVAL } from '@/lib/constants'
import {
  WalletsNotAvailableError, WalletSenderError, WalletAggregateError, WalletNotEnabledError,
  WalletSendNotConfiguredError, WalletPaymentError, WalletError, WalletConfigurationError
} from '@/wallets/errors'
import { canSend } from './common'

export function useWalletPayment () {
  const { wallets } = useWallets()
  const invoiceHelper = useInvoice()

  // XXX calling hooks in a loop is against the rules of hooks
  //
  // we do this here anyway since we need the logger for each wallet.
  // hooks are always called in the same order since walletDefs does not change between renders.
  //
  // we don't use the return value of useWallets here because it is empty on first render
  // so using it would change the order of the hooks between renders.
  //
  // see https://react.dev/reference/rules/rules-of-hooks
  const loggers = walletDefs
    .reduce((acc, def) => {
      return {
        ...acc,
        [def.name]: useWalletLogger(def)?.logger
      }
    }, {})

  const walletsWithPayments = useMemo(() => {
    return wallets
      .filter(wallet => canSend(wallet))
      .map(wallet => {
        const logger = loggers[wallet.def.name]
        return {
          ...wallet,
          sendPayment: sendPayment(wallet, logger)
        }
      })
  }, [wallets, loggers])

  const waitForPayment = useCallback(async (invoice, { waitFor }) => {
    let walletError = new WalletAggregateError([])
    let walletInvoice = invoice

    for (const [i, wallet] of walletsWithPayments.entries()) {
      const controller = invoiceController(walletInvoice, invoiceHelper.isInvoice)
      try {
        return await new Promise((resolve, reject) => {
          // can't await wallet payments since we might pay hold invoices and thus payments might not settle immediately.
          // that's why we separately check if we received the payment with the invoice controller.
          wallet.sendPayment(walletInvoice).catch(reject)
          controller.wait(waitFor)
            .then(resolve)
            .catch(reject)
        })
      } catch (err) {
        // cancel invoice to make sure it cannot be paid later and create new invoice to retry.
        // we only need to do this if payment was attempted which is not the case if the wallet is not enabled.
        const paymentAttempt = err instanceof WalletPaymentError
        if (paymentAttempt) {
          await invoiceHelper.cancel(walletInvoice)

          // is there another wallet to try?
          const lastAttempt = i === walletsWithPayments.length - 1
          if (!lastAttempt) {
            walletInvoice = await invoiceHelper.retry(walletInvoice)
          }
        }

        // TODO: receiver fallbacks
        //
        // if payment failed because of the receiver, we should use the same wallet again.
        // if (err instanceof ReceiverError) { ... }

        // try next wallet if the payment failed because of the wallet
        // and not because it expired or was canceled
        const isWalletError = err instanceof WalletError
        if (isWalletError) {
          walletError = new WalletAggregateError([...walletError.errors, err], walletInvoice)
          continue
        }

        // payment failed not because of the sender or receiver wallet. bail out of attemping wallets.
        throw err
      } finally {
        controller.stop()
      }
    }

    // if we reach this line, no wallet payment succeeded

    // throw a special error that caller can handle separately if no payment was attempted
    const noWalletAvailable = walletError.errors.every(e => e instanceof WalletConfigurationError)
    if (noWalletAvailable) {
      throw new WalletsNotAvailableError()
    }

    // only return payment errors
    const paymentErrors = walletError.errors.filter(e => e instanceof WalletPaymentError)
    throw new WalletAggregateError(paymentErrors, walletInvoice)
  }, [walletsWithPayments, invoiceHelper])

  return waitForPayment
}

const invoiceController = (inv, isInvoice) => {
  const controller = new AbortController()
  const signal = controller.signal
  controller.wait = async (waitFor = inv => inv?.actionState === 'PAID') => {
    return await new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const paid = await isInvoice(inv, waitFor)
          if (paid) {
            resolve(inv)
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
        resolve(inv)
        clearInterval(interval)
        signal.removeEventListener('abort', abort)
      }
      signal.addEventListener('abort', abort)
    })
  }

  controller.stop = () => controller.abort()

  return controller
}

function sendPayment (wallet, logger) {
  return async (invoice) => {
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
  }
}
