import { useCallback, useMemo } from 'react'
import { useMe } from './me'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import { useWallet } from 'wallets'
import { FAST_POLL_INTERVAL, JIT_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { INVOICE } from '@/fragments/wallet'
import Invoice from '@/components/invoice'
import { useFeeButton } from './fee-button'
import { useShowModal } from './modal'

export class InvoiceCanceledError extends Error {
  constructor (hash, actionError) {
    super(actionError ?? `invoice canceled: ${hash}`)
    this.name = 'InvoiceCanceledError'
    this.hash = hash
    this.actionError = actionError
  }
}

export class NoAttachedWalletError extends Error {
  constructor () {
    super('no attached wallet found')
    this.name = 'NoAttachedWalletError'
  }
}

export class InvoiceExpiredError extends Error {
  constructor (hash) {
    super(`invoice expired: ${hash}`)
    this.name = 'InvoiceExpiredError'
  }
}

export const useInvoice = () => {
  const client = useApolloClient()

  const [createInvoice] = useMutation(gql`
    mutation createInvoice($amount: Int!, $expireSecs: Int!) {
      createInvoice(amount: $amount, hodlInvoice: true, expireSecs: $expireSecs) {
        id
        bolt11
        hash
        hmac
        expiresAt
        satsRequested
      }
    }`)
  const [cancelInvoice] = useMutation(gql`
    mutation cancelInvoice($hash: String!, $hmac: String!) {
      cancelInvoice(hash: $hash, hmac: $hmac) {
        id
      }
    }
  `)

  const create = useCallback(async amount => {
    const { data, error } = await createInvoice({ variables: { amount, expireSecs: JIT_INVOICE_TIMEOUT_MS / 1000 } })
    if (error) {
      throw error
    }
    const invoice = data.createInvoice
    return invoice
  }, [createInvoice])

  const isInvoice = useCallback(async ({ id }, that) => {
    const { data, error } = await client.query({ query: INVOICE, fetchPolicy: 'network-only', variables: { id } })
    if (error) {
      throw error
    }
    const { hash, cancelled, actionError } = data.invoice

    if (cancelled || actionError) {
      throw new InvoiceCanceledError(hash, actionError)
    }

    return that(data.invoice)
  }, [client])

  const waitController = useMemo(() => {
    const controller = new AbortController()
    const signal = controller.signal
    controller.wait = async ({ id }, waitFor = inv => (inv.satsReceived > 0)) => {
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
  }, [isInvoice])

  const cancel = useCallback(async ({ hash, hmac }) => {
    if (!hash || !hmac) {
      throw new Error('missing hash or hmac')
    }

    console.log('canceling invoice:', hash)
    const inv = await cancelInvoice({ variables: { hash, hmac } })
    return inv
  }, [cancelInvoice])

  return { create, waitUntilPaid: waitController.wait, stopWaiting: waitController.stop, cancel }
}

export const useWalletPayment = () => {
  const invoice = useInvoice()
  const wallet = useWallet()

  const waitForWalletPayment = useCallback(async ({ id, bolt11 }, waitFor) => {
    if (!wallet) {
      throw new NoAttachedWalletError()
    }
    try {
      return await new Promise((resolve, reject) => {
        // can't use await here since we might pay JIT invoices and sendPaymentAsync is not supported yet.
        // see https://www.webln.guide/building-lightning-apps/webln-reference/webln.sendpaymentasync
        wallet.sendPayment(bolt11)
          // JIT invoice payments will never resolve here
          // since they only get resolved after settlement which can't happen here
          .then(resolve)
          .catch(reject)
        invoice.waitUntilPaid({ id }, waitFor)
          .then(resolve)
          .catch(reject)
      })
    } catch (err) {
      console.error('payment failed:', err)
      throw err
    } finally {
      invoice.stopWaiting()
    }
  }, [wallet, invoice])

  return waitForWalletPayment
}

export const useQrPayment = () => {
  const invoice = useInvoice()
  const showModal = useShowModal()

  const waitForQrPayment = useCallback(async (inv, walletError,
    {
      keepOpen = true,
      cancelOnClose = true,
      persistOnNavigate = false,
      waitFor = inv => inv?.satsReceived > 0
    } = {}
  ) => {
    return await new Promise((resolve, reject) => {
      let paid
      const cancelAndReject = async (onClose) => {
        if (!paid && cancelOnClose) {
          await invoice.cancel(inv).catch(console.error)
          reject(new InvoiceCanceledError(inv?.hash))
        }
        resolve()
      }
      showModal(onClose =>
        <Invoice
          id={inv.id}
          modal
          description
          status='loading'
          successVerb='received'
          useWallet={false}
          walletError={walletError}
          waitFor={waitFor}
          onCanceled={inv => { onClose(); reject(new InvoiceCanceledError(inv?.hash, inv?.actionError)) }}
          onPayment={() => { paid = true; onClose(); resolve() }}
          poll
        />,
      { keepOpen, persistOnNavigate, onClose: cancelAndReject })
    })
  }, [invoice])

  return waitForQrPayment
}

export const usePayment = () => {
  const me = useMe()
  const feeButton = useFeeButton()
  const invoice = useInvoice()
  const waitForWalletPayment = useWalletPayment()
  const waitForQrPayment = useQrPayment()

  const waitForPayment = useCallback(async (invoice) => {
    let walletError
    try {
      return await waitForWalletPayment(invoice)
    } catch (err) {
      if (err instanceof InvoiceCanceledError || err instanceof InvoiceExpiredError) {
        // bail since qr code payment will also fail
        throw err
      }
      walletError = err
    }
    return await waitForQrPayment(invoice, walletError)
  }, [waitForWalletPayment, waitForQrPayment])

  const request = useCallback(async (amount) => {
    amount ??= feeButton?.total
    const free = feeButton?.free
    const balance = me ? me.privates.sats : 0

    // if user has enough funds in their custodial wallet or action is free, never prompt for payment
    // XXX this will probably not work as intended for deposits < balance
    //   which means you can't always fund your custodial wallet with attached wallets ...
    //   but should this even be the case?
    const insufficientFunds = balance < amount
    if (free || !insufficientFunds) return [{ hash: null, hmac: null }, null]

    const inv = await invoice.create(amount)

    await waitForPayment(inv)

    const cancel = () => invoice.cancel(inv).catch(console.error)
    return [inv, cancel]
  }, [me, feeButton?.total, invoice, waitForPayment])

  const cancel = useCallback(({ hash, hmac }) => {
    if (hash && hmac) {
      invoice.cancel({ hash, hmac }).catch(console.error)
    }
  }, [invoice])

  return { request, cancel }
}
