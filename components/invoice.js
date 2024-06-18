import { useState, useEffect } from 'react'
import { numWithUnits } from '@/lib/format'
import AccordianItem from './accordian-item'
import Qr, { QrSkeleton } from './qr'
import { CompactLongCountdown } from './countdown'
import PayerData from './payer-data'
import Bolt11Info from './bolt11-info'
import { useQuery } from '@apollo/client'
import { INVOICE } from '@/fragments/wallet'
import { FAST_POLL_INTERVAL, SSR } from '@/lib/constants'
import { WebLnNotEnabledError } from './payment'
import ItemJob from './item-job'
import Item from './item'
import { CommentFlat } from './comment'
import classNames from 'classnames'

export default function Invoice ({ id, query = INVOICE, modal, onPayment, info, successVerb, webLn = true, webLnError, poll, ...props }) {
  const [expired, setExpired] = useState(false)
  const { data, error } = useQuery(query, SSR
    ? {}
    : {
        pollInterval: FAST_POLL_INTERVAL,
        variables: { id },
        nextFetchPolicy: 'cache-and-network',
        skip: !poll
      })

  const invoice = data?.invoice

  useEffect(() => {
    if (!invoice) {
      return
    }
    if (invoice.confirmedAt || (invoice.isHeld && invoice.satsReceived)) {
      onPayment?.(invoice)
    }
    setExpired(new Date(invoice.expiredAt) <= new Date())
  }, [invoice, onPayment, setExpired])

  if (error) {
    return <div>{error.message}</div>
  }

  if (!invoice) {
    return <QrSkeleton {...props} />
  }

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
  } else if (invoice.expiresAt) {
    variant = 'pending'
    status = (
      <CompactLongCountdown
        date={invoice.expiresAt} onComplete={() => {
          setExpired(true)
        }}
      />
    )
  }

  const { nostr, comment, lud18Data, bolt11, confirmedPreimage } = invoice

  return (
    <>
      {webLnError && !(webLnError instanceof WebLnNotEnabledError) &&
        <div className='text-center fw-bold text-info mb-3' style={{ lineHeight: 1.25 }}>
          Paying from attached wallet failed:
          <code> {webLnError.message}</code>
        </div>}
      <Qr
        webLn={webLn} value={invoice.bolt11}
        description={numWithUnits(invoice.satsRequested, { abbreviate: false })}
        statusVariant={variant} status={status}
      />
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
          {invoice?.item && <ActionInfo invoice={invoice} />}
        </>}
    </>
  )
}

function ActionInfo ({ invoice }) {
  if (!invoice.actionType) return null

  let className = 'text-info'
  let actionString = ''
  switch (invoice.actionType) {
    case 'ITEM_CREATE':
      actionString = 'item creation '
      break
    case 'ZAP':
      actionString = 'zap on item '
      break
    case 'DOWN_ZAP':
      actionString = 'downzap on item '
      break
  }

  switch (invoice.actionState) {
    case 'FAILED':
      actionString += 'failed'
      className = 'text-warning'
      break
    case 'PAID':
      actionString += 'paid'
      break
    default:
      actionString += 'pending'
  }

  return (
    <div className='text-start w-100 my-3'>
      <div className={classNames('fw-bold', 'pb-1', className)}>{actionString}</div>
      {(invoice.item?.isJob && <ItemJob item={invoice?.item} />) ||
       (invoice.item?.title && <Item item={invoice?.item} />) ||
         <CommentFlat item={invoice.item} includeParent noReply truncate />}
    </div>
  )
}
