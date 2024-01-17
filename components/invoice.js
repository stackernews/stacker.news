import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQuery } from '@apollo/client'
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

export function Invoice ({ invoice, modal, onPayment, info, successVerb }) {
  const [expired, setExpired] = useState(new Date(invoice.expiredAt) <= new Date())

  let variant = 'default'
  let status = 'waiting for you'
  let webLn = true
  if (invoice.confirmedAt || (invoice.isHeld && invoice.satsReceived && !expired)) {
    variant = 'confirmed'
    status = `${numWithUnits(invoice.satsReceived, { abbreviate: false })} ${successVerb || 'deposited'}`
    webLn = false
  } else if (expired) {
    variant = 'failed'
    status = 'expired'
    webLn = false
  } else if (invoice.cancelled) {
    variant = 'failed'
    status = 'cancelled'
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
      <Invoice invoice={data.invoice} modal onPayment={onPayment} successVerb='received' />
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

  const onSubmitWrapper = useCallback(async ({ cost, ...formValues }, ...submitArgs) => {
    // some actions require a session
    if (!me && options.requireSession) {
      throw new Error('you must be logged in')
    }

    // educated guesses where action might pass in the invoice amount
    // (field 'cost' has highest precedence)
    cost ??= formValues.amount

    // attempt action for the first time
    if (!cost || (me && !options.forceInvoice)) {
      try {
        return await onSubmit(formValues, ...submitArgs)
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

    // wait until invoice is paid or modal is closed
    let modalClose
    await new Promise((resolve, reject) => {
      showModal(onClose => {
        modalClose = onClose
        return (
          <JITInvoice
            invoice={inv}
            onPayment={resolve}
          />
        )
      }, { keepOpen: true, onClose: reject })
    })

    const retry = () => onSubmit({ hash: inv.hash, hmac: inv.hmac, ...formValues }, ...submitArgs)
    // first retry
    try {
      const ret = await retry()
      modalClose()
      return ret
    } catch (error) {
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
            }}
          />
        )
      }, { keepOpen: true, onClose: cancelAndReject })
    })
  }, [onSubmit, createInvoice, !!me])

  return onSubmitWrapper
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
