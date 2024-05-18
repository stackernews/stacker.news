import { useCallback } from 'react'
import { useMe } from './me'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import { useWebLN } from './webln'
import { FAST_POLL_INTERVAL, JIT_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { INVOICE } from '@/fragments/wallet'
import Invoice from '@/components/invoice'
import { useFeeButton } from './fee-button'
import { useShowModal } from './modal'

export class InvoiceCanceledError extends Error {
  constructor (hash) {
    super(`invoice canceled: ${hash}`)
    this.name = 'InvoiceCanceledError'
  }
}

export class WebLnNotEnabledError extends Error {
  constructor () {
    super('no enabled WebLN provider found')
    this.name = 'WebLnNotEnabledError'
  }
}

export class InvoiceExpiredError extends Error {
  constructor () {
    super('invoice expired')
    this.name = 'InvoiceExpiredError'
  }
}

const useInvoice = () => {
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

  const isPaid = useCallback(async id => {
    const { data, error } = await client.query({ query: INVOICE, fetchPolicy: 'no-cache', variables: { id } })
    if (error) {
      throw error
    }
    const { hash, isHeld, satsReceived, cancelled } = data.invoice
    // if we're polling for invoices, we're using JIT invoices so isHeld must be set
    if (isHeld && satsReceived) {
      return true
    }
    if (cancelled) {
      throw new InvoiceCanceledError(hash)
    }
    return false
  }, [client])

  const waitUntilPaid = useCallback(async id => {
    return await new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const paid = await isPaid(id)
          if (paid) {
            resolve()
            clearInterval(interval)
          }
        } catch (err) {
          reject(err)
          clearInterval(interval)
        }
      }, FAST_POLL_INTERVAL)
    })
  }, [isPaid])

  const cancel = useCallback(async ({ hash, hmac }) => {
    return await cancelInvoice({ variables: { hash, hmac } })
  }, [cancelInvoice])

  return { create, isPaid, waitUntilPaid, cancel }
}

const useWebLnPayment = () => {
  const invoice = useInvoice()
  const provider = useWebLN()

  const waitForWebLnPayment = useCallback(async ({ id, bolt11 }) => {
    if (!provider) {
      throw new WebLnNotEnabledError()
    }
    try {
      return await new Promise((resolve, reject) => {
        // can't use await here since we might pay JIT invoices and sendPaymentAsync is not supported yet.
        // see https://www.webln.guide/building-lightning-apps/webln-reference/webln.sendpaymentasync
        provider.sendPayment(bolt11)
          // JIT invoice payments will never resolve here
          // since they only get resolved after settlement which can't happen here
          .then(resolve)
          .catch(reject)
        invoice.waitUntilPaid(id)
          .then(resolve)
          .catch(reject)
      })
    } catch (err) {
      console.error('WebLN payment failed:', err)
      throw err
    }
  }, [provider, invoice])

  return waitForWebLnPayment
}

const useQrPayment = () => {
  const invoice = useInvoice()
  const showModal = useShowModal()

  const waitForQrPayment = useCallback(async (inv, webLnError) => {
    return await new Promise((resolve, reject) => {
      let paid
      const cancelAndReject = async (onClose) => {
        if (paid) return
        await invoice.cancel(inv)
        reject(new InvoiceCanceledError(inv.hash))
      }
      showModal(onClose =>
        <Invoice
          invoice={inv}
          modal
          successVerb='received'
          webLn={false}
          webLnError={webLnError}
          onPayment={() => { paid = true; onClose(); resolve() }}
          poll
        />,
      { keepOpen: true, onClose: cancelAndReject })
    })
  }, [invoice])

  return waitForQrPayment
}

export const usePayment = () => {
  const me = useMe()
  const feeButton = useFeeButton()
  const invoice = useInvoice()
  const waitForWebLnPayment = useWebLnPayment()
  const waitForQrPayment = useQrPayment()

  const waitForPayment = useCallback(async (invoice) => {
    let webLnError
    try {
      return await waitForWebLnPayment(invoice)
    } catch (err) {
      if (err instanceof InvoiceCanceledError || err instanceof InvoiceExpiredError) {
        // bail since qr code payment will also fail
        throw err
      }
      webLnError = err
    }
    return await waitForQrPayment(invoice, webLnError)
  }, [waitForWebLnPayment, waitForQrPayment])

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
