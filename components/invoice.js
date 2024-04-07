import { useState, useEffect } from 'react'
import { useQuery } from '@apollo/client'
import { Button } from 'react-bootstrap'
import { numWithUnits } from '@/lib/format'
import AccordianItem from './accordian-item'
import Qr, { QrSkeleton } from './qr'
import { INVOICE } from '@/fragments/wallet'
import InvoiceStatus from './invoice-status'
import Countdown from './countdown'
import PayerData from './payer-data'
import Bolt11Info from './bolt11-info'

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

export const JITInvoice = ({ invoice: { id, hash, hmac, expiresAt }, onPayment, onCancel, onRetry }) => {
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
