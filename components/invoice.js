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
import { sleep } from '../lib/time'
import FundError, { isInsufficientFundsError } from './fund-error'
import Countdown from './countdown'

export function Invoice ({ invoice, onPayment, successVerb }) {
  let variant = 'default'
  let status = 'waiting for you'
  let webLn = true
  if (invoice.confirmedAt || invoice.isHeld) {
    variant = 'confirmed'
    status = `${numWithUnits(invoice.satsReceived || invoice.satsHeld, { abbreviate: false })} ${successVerb || 'deposited'}`
    webLn = false
  } else if (invoice.cancelled) {
    variant = 'failed'
    status = 'cancelled'
    webLn = false
  } else if (new Date(invoice.expiresAt) <= new Date()) {
    variant = 'failed'
    status = 'expired'
    webLn = false
  }

  useEffect(() => {
    if (invoice.confirmedAt || invoice.isHeld) {
      onPayment?.(invoice)
    }
  }, [invoice.confirmedAt, invoice.isHeld])

  const { nostr } = invoice

  return (
    <>
      <Qr
        webLn={webLn} value={invoice.bolt11}
        description={numWithUnits(invoice.satsRequested, { abbreviate: false })}
        statusVariant={variant} status={status}
      />
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
    </>
  )
}

const ActionInvoice = ({ id, hash, hmac, errorCount, repeat, onClose, expiresAt, ...props }) => {
  const { data, loading, error } = useQuery(INVOICE, {
    pollInterval: 1000,
    variables: { id }
  })
  const [cancelInvoice] = useMutation(gql`
    mutation cancelInvoice($hash: String!, $hmac: String!) {
      cancelInvoice(hash: $hash, hmac: $hmac) {
        id
      }
    }
  `)
  if (error) {
    if (error.message?.includes('invoice not found')) {
      return
    }
    return <div>error</div>
  }
  if (!data || loading) {
    return <QrSkeleton description status='loading' />
  }

  let errorStatus = 'Something went wrong trying to perform the action after payment.'
  if (errorCount > 1) {
    errorStatus = 'Something still went wrong.\nYou can retry or cancel the invoice to return your funds.'
  }
  return (
    <>
      <Invoice invoice={data.invoice} {...props} />
      <div className='text-muted text-center fw-bold'><Countdown date={expiresAt} /></div>
      {errorCount > 0
        ? (
          <>
            <div className='my-3'>
              <InvoiceStatus variant='failed' status={errorStatus} />

            </div>
            <div className='d-flex flex-row mt-3 justify-content-center'>
              <Button className='mx-1' variant='info' onClick={repeat}>Retry</Button>
              <Button
                className='mx-1'
                variant='danger' onClick={async () => {
                  await cancelInvoice({ variables: { hash, hmac } })
                  onClose()
                }}
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
  forceInvoice: false,
  requireSession: false
}
export const useInvoiceable = (fn, options = defaultOptions) => {
  const me = useMe()
  const [createInvoice, { data }] = useMutation(gql`
    mutation createInvoice($amount: Int!) {
      createInvoice(amount: $amount, hodlInvoice: true, expireSecs: 1800) {
        id
        hash
        hmac
        expiresAt
      }
    }`)
  const showModal = useShowModal()
  const [fnArgs, setFnArgs] = useState()

  let errorCount = 0
  const onPayment = useCallback(
    (onClose, hmac) => {
      return async ({ id, satsReceived, expiresAt, hash }) => {
        await sleep(500)
        const repeat = () =>
          fn(satsReceived, ...fnArgs, hash, hmac)
            .then(onClose)
            .catch((error) => {
              console.error(error)
              errorCount++
              onClose()
              showModal(onClose => (
                <ActionInvoice
                  id={id}
                  hash={hash}
                  hmac={hmac}
                  expiresAt={expiresAt}
                  onClose={onClose}
                  onPayment={onPayment(onClose, hmac)}
                  successVerb='received'
                  errorCount={errorCount}
                  repeat={repeat}
                />
              ), { keepOpen: true })
            })
        // prevents infinite loop of calling `onPayment`
        if (errorCount === 0) await repeat()
      }
    }, [fn, fnArgs]
  )

  const invoice = data?.createInvoice
  useEffect(() => {
    if (invoice) {
      showModal(onClose => (
        <ActionInvoice
          id={invoice.id}
          hash={invoice.hash}
          hmac={invoice.hmac}
          expiresAt={invoice.expiresAt}
          onClose={onClose}
          onPayment={onPayment(onClose, invoice.hmac)}
          successVerb='received'
        />
      ), { keepOpen: true }
      )
    }
  }, [invoice?.id])

  const actionFn = useCallback(async (amount, ...args) => {
    if (!me && options.requireSession) {
      throw new Error('you must be logged in')
    }
    if (!amount || (me && !options.forceInvoice)) {
      try {
        return await fn(amount, ...args)
      } catch (error) {
        if (isInsufficientFundsError(error)) {
          showModal(onClose => {
            return (
              <FundError
                onClose={onClose}
                amount={amount}
                onPayment={async (_, invoiceHash, invoiceHmac) => { await fn(amount, ...args, invoiceHash, invoiceHmac) }}
              />
            )
          })
          return { keepLocalStorage: true }
        }
        throw error
      }
    }
    setFnArgs(args)
    await createInvoice({ variables: { amount } })
    // tell onSubmit handler that we want to keep local storage
    // even though the submit handler was "successful"
    return { keepLocalStorage: true }
  }, [fn, setFnArgs, createInvoice])

  return actionFn
}
