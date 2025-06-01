import { useEffect } from 'react'
import { numWithUnits } from '@/lib/format'
import AccordianItem from './accordian-item'
import Qr, { QrSkeleton } from './qr'
import { CompactLongCountdown } from './countdown'
import PayerData from './payer-data'
import Bolt11Info from './bolt11-info'
import { useQuery } from '@apollo/client'
import { INVOICE } from '@/fragments/invoice'
import { FAST_POLL_INTERVAL, SSR } from '@/lib/constants'
import { WalletConfigurationError, WalletPaymentAggregateError } from '@/wallets/client/errors'
import ItemJob from './item-job'
import Item from './item'
import { CommentFlat } from './comment'
import classNames from 'classnames'
import Moon from '@/svgs/moon-fill.svg'
import { Badge } from 'react-bootstrap'
import styles from './invoice.module.css'

export default function Invoice ({
  id, query = INVOICE, modal, onPayment, onExpired, onCanceled, info, successVerb = 'deposited',
  heldVerb = 'settling', walletError, poll, waitFor, ...props
}) {
  const { data, error } = useQuery(query, SSR
    ? {}
    : {
        pollInterval: FAST_POLL_INTERVAL,
        variables: { id },
        nextFetchPolicy: 'cache-and-network',
        skip: !poll
      })

  const invoice = data?.invoice

  const expired = invoice?.cancelledAt && new Date(invoice.expiresAt) < new Date(invoice.cancelledAt)

  useEffect(() => {
    if (!invoice) {
      return
    }
    if (waitFor?.(invoice)) {
      onPayment?.(invoice)
    }
    if (expired) {
      onExpired?.(invoice)
    } else if (invoice.cancelled || invoice.actionError) {
      onCanceled?.(invoice)
    }
  }, [invoice, expired, onExpired, onCanceled, onPayment])

  if (error) {
    return <div>{error.message}</div>
  }

  if (!invoice) {
    return <QrSkeleton {...props} />
  }

  let variant = 'default'
  let status = 'waiting for you'
  let sats = invoice.satsRequested
  if (invoice.forwardedSats) {
    if (invoice.actionType === 'RECEIVE') {
      successVerb = 'forwarded'
      sats = invoice.forwardedSats
    } else {
      successVerb = 'zapped'
    }
  }

  if (invoice.confirmedAt) {
    variant = 'confirmed'
    status = (
      <>
        {numWithUnits(sats, { abbreviate: false })}
        {' '}
        {successVerb}
        {' '}
        {invoice.forwardedSats && <Badge className={styles.badge} bg={null}>p2p</Badge>}
      </>
    )
  } else if (expired) {
    variant = 'failed'
    status = 'expired'
  } else if (invoice.cancelled) {
    variant = 'failed'
    status = 'cancelled'
  } else if (invoice.isHeld) {
    variant = 'pending'
    status = (
      <div className='d-flex justify-content-center'>
        <Moon className='spin fill-grey me-2' /> {heldVerb}
      </div>
    )
  } else {
    variant = 'pending'
    status = (
      <CompactLongCountdown date={invoice.expiresAt} />
    )
  }

  const { bolt11, confirmedPreimage } = invoice

  return (
    <>
      <WalletError error={walletError} />
      <Qr
        value={invoice.bolt11}
        description={numWithUnits(invoice.satsRequested, { abbreviate: false })}
        statusVariant={variant} status={status}
      />
      {!modal &&
        <>
          {info && <div className='text-muted fst-italic text-center'>{info}</div>}
          <InvoiceExtras {...invoice} />
          <Bolt11Info bolt11={bolt11} preimage={confirmedPreimage} />
          {invoice?.item && <ActionInfo invoice={invoice} />}
        </>}
    </>
  )
}

export function InvoiceExtras ({ nostr, lud18Data, comment }) {
  return (
    <>
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
            body={<PayerData data={lud18Data} className='text-muted ms-3' />}
            className='mb-3'
          />
        </div>}
      {comment &&
        <div className='w-100'>
          <AccordianItem
            header='sender comments'
            body={<span className='text-muted ms-3'>{comment}</span>}
            className='mb-3'
          />
        </div>}
    </>
  )
}

function ActionInfo ({ invoice }) {
  if (!invoice.actionType) return null

  let className = 'text-info'
  let actionString = ''

  switch (invoice.actionState) {
    case 'FAILED':
    case 'RETRYING':
      actionString += 'attempted '
      className = 'text-warning'
      break
    case 'PAID':
      actionString += 'successful '
      className = 'text-success'
      break
    default:
      actionString += 'pending '
  }

  switch (invoice.actionType) {
    case 'ITEM_CREATE':
      actionString += 'item creation'
      break
    case 'ZAP':
      actionString += 'zap on item'
      break
    case 'DOWN_ZAP':
      actionString += 'downzap on item'
      break
    case 'POLL_VOTE':
      actionString += 'poll vote'
      break
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

function WalletError ({ error }) {
  if (!error || error instanceof WalletConfigurationError) return null

  if (!(error instanceof WalletPaymentAggregateError)) {
    console.error('unexpected wallet error:', error)
    return null
  }

  return (
    <div className='text-center fw-bold text-info mb-3' style={{ lineHeight: 1.25 }}>
      <div className='text-info mb-2'>Paying from attached wallets failed:</div>
      {error.errors.map((e, i) => (
        <div key={i}>
          <code>{e.wallet}: {e.reason || e.message}</code>
        </div>
      ))}
    </div>
  )
}
