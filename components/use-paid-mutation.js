import { useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import { useCallback, useState } from 'react'
import { useInvoice, useQrPayment, useWalletPayment } from './payment'
import { InvoiceCanceledError } from '@/wallets/errors'
import { GET_PAID_ACTION, RETRY_PAID_ACTION } from '@/fragments/paidAction'
import { useWallets, useWallet } from '@/wallets/index'
import { canSend } from '@/wallets/common'
import { useMe } from './me'
/*
this is just like useMutation with a few changes:
1. pays an invoice returned by the mutation
2. takes an onPaid and onPayError callback, and additional options for payment behavior
  - namely forceWaitForPayment which will always wait for the invoice to be paid
  - and persistOnNavigate which will keep the invoice in the cache after navigation
3. onCompleted behaves a little differently, but analogously to useMutation, ie clientside side effects
  of completion can still rely on it
  a. it's called before the invoice is paid for optimistic updates
  b. it's called after the invoice is paid for pessimistic updates
4. we return a payError field in the result object if the invoice fails to pay
*/
export function usePaidMutation (mutation,
  { onCompleted, ...options } = {}) {
  options.optimisticResponse = addOptimisticResponseExtras(options.optimisticResponse)
  const [mutate, result] = useMutation(mutation, options)
  const [getPaidAction] = useLazyQuery(GET_PAID_ACTION, {
    fetchPolicy: 'network-only'
  })
  const [retryPaidAction] = useMutation(RETRY_PAID_ACTION)
  const waitForWalletPayment = useWalletPayment()
  const invoiceHelper = useInvoice()
  const waitForQrPayment = useQrPayment()
  const client = useApolloClient()
  // innerResult is used to store/control the result of the mutation when innerMutate runs
  const [innerResult, setInnerResult] = useState(result)
  const { wallets: walletDefs } = useWallets()
  const { me } = useMe()

  const addPayError = (e, rest) => ({
    ...rest,
    payError: e,
    error: e instanceof InvoiceCanceledError && e.actionError ? e : undefined
  })

  // walletDefs shouldn't change on rerender, so it should be safe
  const senderWallets = walletDefs
    .map(w => useWallet(w.def.name))
    .filter(w => !w.def.isAvailable || w.def.isAvailable())
    .filter(w => w.config?.enabled && canSend(w)).map(w => {
      return { ...w, failed: false }
    })

  const waitForActionPayment = useCallback(async (invoice, { alwaysShowQROnFailure = false, persistOnNavigate = false, waitFor }, originalResponse, action) => {
    const walletErrors = []
    let response = originalResponse
    let invoiceUsed = false

    const cancelInvoice = async () => {
      try {
        invoiceUsed = true
        await invoiceHelper.cancel(invoice)
        console.log('old invoice canceled')
      } catch (err) {
        console.error('could not cancel old invoice', err)
      }
    }

    // ensures every invoice is used only once
    const refreshInvoice = async (attempt = 0) => {
      if (invoiceUsed) {
        await cancelInvoice()
        const retry = await retryPaidAction({ variables: { invoiceId: parseInt(invoice.id), attempt } })
        response = retry.data?.retryPaidAction
        invoice = response?.invoice
        invoiceUsed = true
      } else invoiceUsed = true
    }

    // if anon we go straight to qr code
    if (!me) {
      await refreshInvoice()
      if (!invoice) {
        setInnerResult(r => addPayError(new Error('You must be logged in'), r))
        throw new Error('You must be logged in')
      }
      await waitForQrPayment(invoice, null, { persistOnNavigate, waitFor })
      return { invoice, response }
    }

    const paymentAttemptStartTime = Date.now()
    // we try with attached wallets
    let attempt = 0
    while (true) {
      await refreshInvoice(attempt)
      if (!invoice) return { invoice, response }

      // first non failed sender wallet
      const senderWallet = senderWallets.find(w => !w.failed)
      if (!senderWallet) {
        console.log('no sender wallet available')
        break
      }

      try {
        console.log('trying to pay with wallet', senderWallet.def.name)
        await waitForWalletPayment(invoice, waitFor, senderWallet)
        console.log('paid with wallet', senderWallet.def.name)
        return { invoice, response }
      } catch (err) {
        walletErrors.push(err)
        // get action data
        const { data: paidActionData } = await getPaidAction({ variables: { invoiceId: parseInt(invoice.id) } })
        const hasWithdrawl = !!paidActionData.invoice?.invoiceForward?.withdrawl
        if (hasWithdrawl) {
          // SN received the payment but couldn't forward it, we try another receiver with the same sender
          if (!response.retriable) { // we are out of receivers
            console.log('the receiver wallet failed to receive the payment, but we exhausted all options')
            break
          }
          console.log('the receiver wallet failed to receive the payment, will try another one')
          attempt++
        } else {
          // SN didn't receive the payment, so the sender must have failed
          senderWallet.failed = true
          console.log('the sender wallet failed to pay the invoice', senderWallet.def.name)
        }
      }
    }

    // we try an internal payment
    try {
      console.log('could not pay with any wallet... will try with an internal payment...')
      await cancelInvoice()
      const retry = await retryPaidAction({ variables: { invoiceId: parseInt(invoice.id), prioritizeInternal: true } })
      response = retry.data?.retryPaidAction
      invoice = response?.invoice
      if (!invoice) {
        return { response }
      } else {
        // if the internal payment returned an invoice, it means it failed
        // maybe the user doesn't have enough credits.
        invoiceUsed = false
      }
    } catch (err) {
      console.log('could not pay with internal payment... will fallback to another method')
      walletErrors.push(err)
    }

    // last resort, show qr code or fail

    // we don't show the qr if too much time has passed from the payment attempt, this prevents
    // very slow payments from resulting in a qr codes being shown unexpectedly during the user navigation
    const failedEarly = paymentAttemptStartTime - Date.now() < 1000
    if (alwaysShowQROnFailure || failedEarly) {
      console.log('show qr code for manual payment')
      await refreshInvoice(attempt)
      await waitForQrPayment(invoice, walletErrors[walletErrors.length - 1], { persistOnNavigate, waitFor })
    } else {
      console.log('we are out of options, we will throw the errors')
      cancelInvoice().catch(console.error)
      throw new Error(walletErrors.map(e => e.message).join('\n'))
    }

    return { invoice, response }
  }, [waitForWalletPayment, waitForQrPayment, invoiceHelper, senderWallets])

  const innerMutate = useCallback(async ({
    onCompleted: innerOnCompleted, ...innerOptions
  } = {}) => {
    innerOptions.optimisticResponse = addOptimisticResponseExtras(innerOptions.optimisticResponse)
    let { data, ...rest } = await mutate({ ...innerOptions })

    // use the most inner callbacks/options if they exist
    const {
      onPaid, onPayError, forceWaitForPayment, persistOnNavigate,
      update, waitFor = inv => inv?.actionState === 'PAID'
    } = { ...options, ...innerOptions }
    const ourOnCompleted = innerOnCompleted || onCompleted

    // get invoice without knowing the mutation name
    if (Object.values(data).length !== 1) {
      throw new Error('usePaidMutation: exactly one mutation at a time is supported')
    }
    const response = Object.values(data)[0]
    const invoice = response?.invoice

    // if the mutation returns an invoice, pay it
    if (invoice) {
      // adds payError, escalating to a normal error if the invoice is not canceled or
      // has an actionError

      const wait = response?.paymentMethod !== 'OPTIMISTIC' || forceWaitForPayment
      const alwaysShowQROnFailure = options.alwaysShowQROnFailure ?? innerOptions.alwaysShowQROnFailure ?? wait
      // should we wait for the invoice to be paid?
      if (!wait) {
        // onCompleted is called before the invoice is paid for optimistic updates
        ourOnCompleted?.(data)
      } else {
        setInnerResult({ data, ...rest })
      }
      // don't wait to pay the invoice
      const p = waitForActionPayment(invoice, { alwaysShowQROnFailure, persistOnNavigate, waitFor }, response, innerOptions).then(async ({ invoice, response }) => {
        if (!response.result) { // supposedly this is never the case for optimistic actions
          // if the mutation didn't return any data, ie pessimistic, we need to fetch it
          const { data: { paidAction } } = await getPaidAction({ variables: { invoiceId: parseInt(invoice.id) } })
          // create new data object
          // ( hmac is only returned on invoice creation so we need to add it back to the data )
          data = {
            [Object.keys(data)[0]]: {
              ...paidAction,
              invoice: { ...paidAction.invoice, hmac: invoice.hmac }
            }
          }
          // we need to run update functions on mutations now that we have the data
          update?.(client.cache, { data })
        }
        if (wait) ourOnCompleted?.(data)
        onPaid?.(client.cache, { data })
        setInnerResult({ data, ...rest })
      }).catch(e => {
        console.error('usePaidMutation: failed to pay invoice', e)
        // onPayError is called after the invoice fails to pay
        // useful for updating invoiceActionState to FAILED
        onPayError?.(e, client.cache, { data })
        setInnerResult(r => addPayError(e, r))
      })

      if (wait) await p
    } else {
      // fee credits paid for it
      ourOnCompleted?.(data)
      onPaid?.(client.cache, { data })
    }

    return { data, ...rest }
  }, [mutate, options, waitForActionPayment, onCompleted, client.cache, getPaidAction, setInnerResult])

  return [innerMutate, innerResult]
}

// all paid actions need these fields and they're easy to forget
function addOptimisticResponseExtras (optimisticResponse) {
  if (!optimisticResponse) return optimisticResponse
  const key = Object.keys(optimisticResponse)[0]
  optimisticResponse[key] = { invoice: null, paymentMethod: 'OPTIMISTIC', retriable: true, ...optimisticResponse[key] }
  return optimisticResponse
}

// most paid actions have the same cache modifications
// these let us preemptively update the cache before a query updates it
export const paidActionCacheMods = {
  update: (cache, { data }) => {
    const response = Object.values(data)[0]
    if (!response?.invoice) return
    const { invoice } = response

    cache.modify({
      id: `Invoice:${invoice.id}`,
      fields: {
        actionState: () => 'PENDING'
      }
    })
  },
  onPayError: (e, cache, { data }) => {
    const response = Object.values(data)[0]
    if (!response?.invoice) return
    const { invoice } = response

    cache.modify({
      id: `Invoice:${invoice.id}`,
      fields: {
        actionState: () => 'FAILED'
      }
    })
  },
  onPaid: (cache, { data }) => {
    const response = Object.values(data)[0]
    if (!response?.invoice) return
    const { invoice } = response

    cache.modify({
      id: `Invoice:${invoice.id}`,
      fields: {
        actionState: () => 'PAID',
        confirmedAt: () => new Date().toISOString(),
        satsReceived: () => invoice.satsRequested
      }
    })
  }
}
