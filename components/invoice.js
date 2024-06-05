import { useState, useEffect } from 'react'
import { numWithUnits } from '@/lib/format'
import AccordianItem from './accordian-item'
import Qr from './qr'
import Countdown from './countdown'
import PayerData from './payer-data'
import Bolt11Info from './bolt11-info'
import { useQuery } from '@apollo/client'
import { INVOICE } from '@/fragments/wallet'
import { FAST_POLL_INTERVAL, SSR } from '@/lib/constants'
import { WebLnNotEnabledError } from './payment'

export default function Invoice ({ invoice, modal, onPayment, info, successVerb, webLn, webLnError, poll }) {
  const [expired, setExpired] = useState(new Date(invoice.expiredAt) <= new Date())

  const { data, error } = useQuery(INVOICE, SSR
    ? {}
    : {
        pollInterval: FAST_POLL_INTERVAL,
        variables: { id: invoice.id },
        nextFetchPolicy: 'cache-and-network',
        skip: !poll
      })

  useEffect(() => {
    if (!data?.invoice) {
      return
    }
    const invoice = data.invoice
    if (invoice.confirmedAt || (invoice.isHeld && invoice.satsReceived)) {
      onPayment?.(invoice)
    }
  }, [data?.invoice, onPayment])

  if (data) {
    invoice = data.invoice
  }

  if (error) {
    return <div>{error.toString()}</div>
  }

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

  const { nostr, comment, lud18Data, bolt11, confirmedPreimage } = invoice

  return (
    <>
      {webLnError && !(webLnError instanceof WebLnNotEnabledError) &&
        <div className='text-center text-danger mb-3'>
          Payment from attached wallet failed:
          <div>{webLnError.toString()}</div>
        </div>}
      <Qr
        webLn={webLn} value={invoice.bolt11}
        description={numWithUnits(invoice.satsRequested, { abbreviate: false })}
        statusVariant={variant} status={status}
      />
      {invoice.confirmedAt
        ? (
          <div className='text-muted text-center invisible'>
            <Countdown date={Date.now()} />
          </div>
          )
        : (
          <div className='text-muted text-center'>
            <Countdown
              date={invoice.expiresAt} onComplete={() => {
                setExpired(true)
              }}
            />
          </div>
          )}
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
