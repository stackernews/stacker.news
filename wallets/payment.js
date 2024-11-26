import { useCallback, useMemo } from 'react'
import { decode as bolt11Decode } from 'bolt11'
import { useWallets } from '@/wallets'
import walletDefs from '@/wallets/client'
import { formatSats } from '@/lib/format'
import { useWalletLogger } from '@/components/wallet-logger'
import { useInvoice } from '@/components/payment'
import { FAST_POLL_INTERVAL } from '@/lib/constants'
import { NoWalletAvailableError, SenderError, WalletAggregateError, WalletNotEnabledError } from '@/wallets/errors'

export function useWalletPayment () {
  const { wallets } = useWallets()
  const invoiceHelper = useInvoice()

  // XXX calling hooks in a loop is against the rules of hooks
  //
  // we do this here anyway since we need the logger for each wallet.
  // we ensure hooks are always called in the same order by sorting the wallets by name.
  //
  // we don't use the return value of useWallets here because it is empty on first render
  // so using it would change the order of the hooks between renders.
  //
  // see https://react.dev/reference/rules/rules-of-hooks
  const loggers = walletDefs
    .sort((def1, def2) => def1.name.localeCompare(def2.name))
    .reduce((acc, def) => {
      return {
        ...acc,
        [def.name]: useWalletLogger(def)?.logger
      }
    }, {})

  const walletsWithPayments = useMemo(() => {
    return wallets.map(wallet => {
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

    for (const wallet of walletsWithPayments) {
      const controller = invoiceController(walletInvoice.id, invoiceHelper.isInvoice)
      try {
        return await new Promise((resolve, reject) => {
          // can't await wallet payments since we might pay hold invoices and thus payments might not settle immediately.
          // that's why we separately check if we received the payment with the invoice controller.
          wallet.sendPayment(walletInvoice.bolt11).catch(reject)
          controller.wait(waitFor)
            .then(resolve)
            .catch(reject)
        })
      } catch (err) {
        // create a new invoice which cancels the previous one
        // to make sure the old one cannot be paid later and we can retry.
        // we don't need to do this if payment failed because wallet is not enabled
        // because we know that it didn't and won't try to pay.
        if (!(err instanceof WalletNotEnabledError)) {
          walletInvoice = await invoiceHelper.retry(walletInvoice)
        }

        // TODO: receiver fallbacks
        //
        // if payment failed because of the receiver, we should use the same wallet again.
        // if (err instanceof ReceiverError) { ... }

        // try next wallet if the payment failed because of the wallet
        // and not because it expired or was canceled
        if (err instanceof WalletNotEnabledError || err instanceof SenderError) {
          walletError = new WalletAggregateError([...walletError.errors, err])
          continue
        }

        // payment failed not because of the sender or receiver wallet. bail out of attemping wallets.
        throw err
      } finally {
        controller.stop()
      }
    }

    // if we reach this line, no wallet payment succeeded

    // if no wallet is enabled, throw a special error that caller can handle separately
    const noWalletAvailable = walletError.errors.every(e => e instanceof WalletNotEnabledError)
    if (noWalletAvailable) {
      throw new NoWalletAvailableError()
    }

    // ignore errors from disabled wallets, only return payment errors
    const paymentErrors = walletError.errors.filter(e => !(e instanceof WalletNotEnabledError))
    throw new WalletAggregateError(paymentErrors)
  }, [walletsWithPayments, invoiceHelper])

  return waitForPayment
}

const invoiceController = (id, isInvoice) => {
  const controller = new AbortController()
  const signal = controller.signal
  controller.wait = async (waitFor = inv => inv?.actionState === 'PAID') => {
    return await new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const paid = await isInvoice({ id }, waitFor)
          if (paid) {
            resolve()
            clearInterval(interval)
            signal.removeEventListener('abort', abort)
          } else {
            console.info(`invoice #${id}: waiting for payment ...`)
          }
        } catch (err) {
          reject(err)
          clearInterval(interval)
          signal.removeEventListener('abort', abort)
        }
      }, FAST_POLL_INTERVAL)

      const abort = () => {
        console.info(`invoice #${id}: stopped waiting`)
        resolve()
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
  return async (bolt11) => {
    if (!wallet.config.enabled) {
      throw new WalletNotEnabledError(wallet.def.name)
    }

    const decoded = bolt11Decode(bolt11)
    logger.info(`↗ sending payment: ${formatSats(decoded.satoshis)}`, { bolt11 })
    try {
      const preimage = await wallet.def.sendPayment(bolt11, wallet.config, { logger })
      logger.ok(`↗ payment sent: ${formatSats(decoded.satoshis)}`, { bolt11, preimage })
    } catch (err) {
      const message = err.message || err.toString?.()
      logger.error(`payment failed: ${message}`, { bolt11 })
      throw new SenderError(wallet.def.name, decoded.tagsObject.payment_hash, message)
    }
  }
}
