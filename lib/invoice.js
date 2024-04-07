import { JITInvoice } from '@/components/invoice'
import { useMe } from '@/components/me'
import { useShowModal } from '@/components/modal'
import { useWebLN } from '@/components/webln'
import { INVOICE } from '@/fragments/wallet'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import { useCallback } from 'react'

const defaultOptions = {
  requireSession: false,
  forceInvoice: false
}
export const useInvoiceable = (onSubmit, options = defaultOptions) => {
  const me = useMe()
  const [createInvoice] = useMutation(gql`
    mutation createInvoice($amount: Int!) {
      createInvoice(amount: $amount, hodlInvoice: true, expireSecs: 180) {
        id
        bolt11
        hash
        hmac
        expiresAt
      }
    }`)
  const [cancelInvoice] = useMutation(gql`
    mutation cancelInvoice($hash: String!, $hmac: String!) {
      cancelInvoice(hash: $hash, hmac: $hmac) {
        id
      }
    }
  `)

  const showModal = useShowModal()
  const provider = useWebLN()
  const client = useApolloClient()
  const pollInvoice = (id) => client.query({ query: INVOICE, fetchPolicy: 'no-cache', variables: { id } })

  const onSubmitWrapper = useCallback(async (
    { cost, ...formValues },
    { variables, optimisticResponse, update, flowId, ...submitArgs }) => {
    // some actions require a session
    if (!me && options.requireSession) {
      throw new Error('you must be logged in')
    }

    // id for toast flows
    if (!flowId) flowId = (+new Date()).toString(16)

    // educated guesses where action might pass in the invoice amount
    // (field 'cost' has highest precedence)
    cost ??= formValues.amount

    // attempt action for the first time
    if (!cost || (me && !options.forceInvoice)) {
      try {
        const insufficientFunds = me?.privates.sats < cost
        return await onSubmit(formValues,
          { ...submitArgs, flowId, variables, optimisticsResponse: insufficientFunds ? null : optimisticResponse, update })
      } catch (error) {
        if (!payOrLoginError(error) || !cost) {
          // can't handle error here - bail
          throw error
        }
      }
    }

    // initial attempt of action failed. we will create an invoice, pay and retry now.
    const { data, error } = await createInvoice({ variables: { amount: cost } })
    if (error) {
      throw error
    }
    const inv = data.createInvoice

    // If this is a zap, we need to manually be optimistic to have a consistent
    // UX across custodial and WebLN zaps since WebLN zaps don't call GraphQL
    // mutations which implement optimistic responses natively.
    // Therefore, we check if this is a zap and then wrap the WebLN payment logic
    // with manual cache update calls.
    const itemId = optimisticResponse?.act?.id
    const isZap = !!itemId
    let _update
    if (isZap && update) {
      _update = () => {
        const fragment = {
          id: `Item:${itemId}`,
          fragment: gql`
          fragment ItemMeSats on Item {
            sats
            meSats
          }
        `
        }
        const item = client.cache.readFragment(fragment)
        update(client.cache, { data: optimisticResponse })
        // undo function
        return () => client.cache.writeFragment({ ...fragment, data: item })
      }
    }

    // wait until invoice is paid or modal is closed
    const { modalOnClose, webLn, gqlCacheUpdateUndo } = await waitForPayment({
      invoice: inv,
      showModal,
      provider,
      pollInvoice,
      gqlCacheUpdate: _update,
      flowId
    })

    const retry = () => onSubmit(
      { hash: inv.hash, hmac: inv.hmac, expiresAt: inv.expiresAt, ...formValues },
      // unset update function since we already ran an cache update if we paid using WebLN
      // also unset update function if null was explicitly passed in
      { ...submitArgs, variables, update: webLn ? null : undefined })
    // first retry
    try {
      const ret = await retry()
      modalOnClose?.()
      return ret
    } catch (error) {
      gqlCacheUpdateUndo?.()
      console.error('retry error:', error)
    }

    // retry until success or cancel
    return await new Promise((resolve, reject) => {
      const cancelAndReject = async () => {
        await cancelInvoice({ variables: { hash: inv.hash, hmac: inv.hmac } })
        reject(new Error('invoice canceled'))
      }
      showModal(onClose => {
        return (
          <JITInvoice
            invoice={inv}
            onCancel={async () => {
              await cancelAndReject()
              onClose()
            }}
            onRetry={async () => {
              resolve(await retry())
              onClose()
            }}
          />
        )
      }, { keepOpen: true, onClose: cancelAndReject })
    })
  }, [onSubmit, provider, createInvoice, !!me])

  return onSubmitWrapper
}

const INVOICE_CANCELED_ERROR = 'invoice canceled'
const waitForPayment = async ({ invoice, showModal, provider, pollInvoice, gqlCacheUpdate, flowId }) => {
  if (provider.enabled) {
    try {
      return await waitForWebLNPayment({ provider, invoice, pollInvoice, gqlCacheUpdate, flowId })
    } catch (err) {
      // check for errors which mean that QR code will also fail
      if (err.message === INVOICE_CANCELED_ERROR) {
        throw err
      }
    }
  }

  // QR code as fallback
  return await new Promise((resolve, reject) => {
    showModal(onClose => {
      return (
        <JITInvoice
          invoice={invoice}
          onPayment={() => resolve({ modalOnClose: onClose })}
        />
      )
    }, { keepOpen: true, onClose: reject })
  })
}

const waitForWebLNPayment = async ({ provider, invoice, pollInvoice, gqlCacheUpdate, flowId }) => {
  let undoUpdate
  try {
    // try WebLN provider first
    return await new Promise((resolve, reject) => {
      // be optimistic and pretend zap was already successful for consistent zapping UX
      undoUpdate = gqlCacheUpdate?.()
      // can't use await here since we might be paying JIT invoices
      // and sendPaymentAsync is not supported yet.
      // see https://www.webln.guide/building-lightning-apps/webln-reference/webln.sendpaymentasync
      provider.sendPayment({ ...invoice, flowId })
        // WebLN payment will never resolve here for JIT invoices
        // since they only get resolved after settlement which can't happen here
        .then(() => resolve({ webLn: true, gqlCacheUpdateUndo: undoUpdate }))
        .catch(err => {
          clearInterval(interval)
          reject(err)
        })
      const interval = setInterval(async () => {
        try {
          const { data, error } = await pollInvoice(invoice.id)
          if (error) {
            clearInterval(interval)
            return reject(error)
          }
          const { invoice: inv } = data
          if (inv.isHeld && inv.satsReceived) {
            clearInterval(interval)
            resolve({ webLn: true, gqlCacheUpdateUndo: undoUpdate })
          }
          if (inv.cancelled) {
            clearInterval(interval)
            reject(new Error(INVOICE_CANCELED_ERROR))
          }
        } catch (err) {
          clearInterval(interval)
          reject(err)
        }
      }, 1000)
    })
  } catch (err) {
    undoUpdate?.()
    console.error('WebLN payment failed:', err)
    throw err
  }
}

export const useInvoiceModal = (onPayment, deps) => {
  const onPaymentMemo = useCallback(onPayment, deps)
  return useInvoiceable(onPaymentMemo, { replaceModal: true })
}

export const payOrLoginError = (error) => {
  const matches = ['insufficient funds', 'you must be logged in or pay']
  if (Array.isArray(error)) {
    return error.some(({ message }) => matches.some(m => message.includes(m)))
  }
  return matches.some(m => error.toString().includes(m))
}
