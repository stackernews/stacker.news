import { useCallback } from 'react'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import { useWallet } from '@/wallets/index'
import { FAST_POLL_INTERVAL, JIT_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { INVOICE } from '@/fragments/wallet'
import Invoice from '@/components/invoice'
import { useShowModal } from './modal'
import { InvoiceCanceledError, NoAttachedWalletError, InvoiceExpiredError } from '@/wallets/errors'

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

    const { hash, cancelled, cancelledAt, actionError, actionState, expiresAt } = data.invoice

    const expired = cancelledAt && new Date(expiresAt) < new Date(cancelledAt)
    if (expired) {
      throw new InvoiceExpiredError(hash)
    }

    if (cancelled || actionError) {
      throw new InvoiceCanceledError(hash, actionError)
    }

    // write to cache if paid
    if (actionState === 'PAID') {
      client.writeQuery({ query: INVOICE, variables: { id }, data: { invoice: data.invoice } })
    }

    return that(data.invoice)
  }, [client])

  const cancel = useCallback(async ({ hash, hmac }) => {
    if (!hash || !hmac) {
      throw new Error('missing hash or hmac')
    }

    console.log('canceling invoice:', hash)
    const inv = await cancelInvoice({ variables: { hash, hmac } })
    return inv
  }, [cancelInvoice])

  return { create, cancel, isInvoice }
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

export const useWalletPayment = () => {
  const invoice = useInvoice()
  const wallet = useWallet()

  const waitForWalletPayment = useCallback(async ({ id, bolt11 }, waitFor) => {
    if (!wallet) {
      throw new NoAttachedWalletError()
    }
    const controller = invoiceController(id, invoice.isInvoice)
    try {
      return await new Promise((resolve, reject) => {
        // can't use await here since we might pay JIT invoices and sendPaymentAsync is not supported yet.
        // see https://www.webln.guide/building-lightning-apps/webln-reference/webln.sendpaymentasync
        wallet.sendPayment(bolt11).catch(reject)
        controller.wait(waitFor)
          .then(resolve)
          .catch(reject)
      })
    } catch (err) {
      console.error('payment failed:', err)
      throw err
    } finally {
      controller.stop()
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
          onExpired={inv => reject(new InvoiceExpiredError(inv?.hash))}
          onCanceled={inv => { onClose(); reject(new InvoiceCanceledError(inv?.hash, inv?.actionError)) }}
          onPayment={() => { paid = true; onClose(); resolve() }}
          poll
        />,
      { keepOpen, persistOnNavigate, onClose: cancelAndReject })
    })
  }, [invoice])

  return waitForQrPayment
}
