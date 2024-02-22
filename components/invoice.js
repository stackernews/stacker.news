import { useState, useCallback, useEffect } from 'react'
import { useApolloClient, useMutation, useQuery } from '@apollo/client'
import { Button } from 'react-bootstrap'
import { gql } from 'graphql-tag'
import { numWithUnits } from '../lib/format'
import AccordianItem from './accordian-item'
import Qr, { QrSkeleton } from './qr'
import { INVOICE } from '../fragments/wallet'
import InvoiceStatus from './invoice-status'
import { useMe } from './me'
import { useShowModal } from './modal'
import Countdown from './countdown'
import PayerData from './payer-data'
import Bolt11Info from './bolt11-info'
import { useWebLN } from './webln'

export function Invoice ({ invoice, modal, onPayment, info, successVerb, webLn }) {
  const [expired, setExpired] = useState(new Date(invoice.expiredAt) <= new Date())

  // if webLn was not passed, use true by default
  if (webLn === undefined) webLn = true

  let variant = 'default'
  let status = 'waiting for you'

  if (invoice.cancelled) {
    variant = 'failed'
    status = 'cancelled'
    webLn = false
  } else if (invoice.confirmedAt || (invoice.isHeld && invoice.satsReceived && !expired)) {
    variant = 'confirmed'
    status = `${numWithUnits(invoice.satsReceived, { abbreviate: false })} ${successVerb || 'deposited'}`
    webLn = false
  } else if (expired) {
    variant = 'failed'
    status = 'expired'
    webLn = false
  }

  useEffect(() => {
    if (invoice.confirmedAt || (invoice.isHeld && invoice.satsReceived)) {
      onPayment?.(invoice)
    }
  }, [invoice.confirmedAt, invoice.isHeld, invoice.satsReceived])

  const { nostr, comment, lud18Data, bolt11, confirmedPreimage } = invoice

  return (
    <>
      <Qr
        webLn={webLn} value={invoice.bolt11}
        description={numWithUnits(invoice.satsRequested, { abbreviate: false })}
        statusVariant={variant} status={status}
      />
      {!invoice.confirmedAt &&
        <div className='text-muted text-center'>
          <Countdown
            date={invoice.expiresAt} onComplete={() => {
              setExpired(true)
            }}
          />
        </div>}
      {!modal &&
        <>
          {info && <div className='text-muted fst-italic text-center'>{info}</div>}
          <div className='w-100'>
            {nostr
              ? <AccordianItem
                  header='Nostr Zap Request'
                  body={
                    <pre>
                      <code>
                        {JSON.stringify(nostr, null, 2)}
                      </code>
                    </pre>
            }
                />
              : null}
          </div>
          {lud18Data &&
            <div className='w-100'>
              <AccordianItem
                header='sender information'
                body={<PayerData data={lud18Data} className='text-muted ms-3 mb-3' />}
              />
            </div>}
          {comment &&
            <div className='w-100'>
              <AccordianItem
                header='sender comments'
                body={<span className='text-muted ms-3'>{comment}</span>}
              />
            </div>}
          <Bolt11Info bolt11={bolt11} preimage={confirmedPreimage} />
        </>}

    </>
  )
}

const JITInvoice = ({ invoice: { id, hash, hmac, expiresAt }, onPayment, onCancel, onRetry }) => {
  const { data, loading, error } = useQuery(INVOICE, {
    pollInterval: 1000,
    variables: { id }
  })
  const [retryError, setRetryError] = useState(0)
  if (error) {
    if (error.message?.includes('invoice not found')) {
      return
    }
    return <div>error</div>
  }
  if (!data || loading) {
    return <QrSkeleton description status='loading' />
  }

  const retry = !!onRetry
  let errorStatus = 'Something went wrong trying to perform the action after payment.'
  if (retryError > 0) {
    errorStatus = 'Something still went wrong.\nYou can retry or cancel the invoice to return your funds.'
  }

  return (
    <>
      <Invoice invoice={data.invoice} modal onPayment={onPayment} successVerb='received' webLn={false} />
      {retry
        ? (
          <>
            <div className='my-3'>
              <InvoiceStatus variant='failed' status={errorStatus} />
            </div>
            <div className='d-flex flex-row mt-3 justify-content-center'>
              <Button
                className='mx-1' variant='info' onClick={async () => {
                  try {
                    await onRetry()
                  } catch (err) {
                    console.error('retry error:', err)
                    setRetryError(retryError => retryError + 1)
                  }
                }}
              >Retry
              </Button>
              <Button
                className='mx-1'
                variant='danger'
                onClick={onCancel}
              >Cancel
              </Button>
            </div>
          </>
          )
        : null}
    </>
  )
}

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
      { hash: inv.hash, hmac: inv.hmac, ...formValues },
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
