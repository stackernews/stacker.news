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
import Countdown from './countdown'
import PayerData from './payer-data'

export function Invoice ({ invoice, onPayment, info, successVerb }) {
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

  const { nostr, comment, lud18Data } = invoice

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
    </>
  )
}

const MutationInvoice = ({ id, hash, hmac, errorCount, repeat, onClose, expiresAt, ...props }) => {
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
  requireSession: false,
  callback: null, // (formValues) => void
  replaceModal: false
}
export const useInvoiceable = (onSubmit, options = defaultOptions) => {
  const me = useMe()
  const [createInvoice, { data }] = useMutation(gql`
    mutation createInvoice($amount: Int!) {
      createInvoice(amount: $amount, hodlInvoice: true, expireSecs: 180) {
        id
        hash
        hmac
        expiresAt
      }
    }`)
  const showModal = useShowModal()
  const [formValues, setFormValues] = useState()
  const [submitArgs, setSubmitArgs] = useState()

  let errorCount = 0
  const onPayment = useCallback(
    (onClose, hmac) => {
      return async ({ id, satsReceived, expiresAt, hash }) => {
        await sleep(500)
        const repeat = () => {
          onClose()
          // call onSubmit handler and pass invoice data
          onSubmit({ satsReceived, hash, hmac, ...formValues }, ...submitArgs)
            .then(() => {
              options?.callback?.(formValues)
            })
            .catch((error) => {
            // if error happened after payment, show repeat and cancel options
            // by passing `errorCount` and `repeat`
              console.error(error)
              errorCount++
              showModal(onClose => (
                <MutationInvoice
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
        }
        // prevents infinite loop of calling `onPayment`
        if (errorCount === 0) await repeat()
      }
    }, [onSubmit, submitArgs]
  )

  const invoice = data?.createInvoice
  useEffect(() => {
    if (invoice) {
      showModal(onClose => (
        <MutationInvoice
          id={invoice.id}
          hash={invoice.hash}
          hmac={invoice.hmac}
          expiresAt={invoice.expiresAt}
          onClose={onClose}
          onPayment={onPayment(onClose, invoice.hmac)}
          successVerb='received'
        />
      ), { replaceModal: options.replaceModal, keepOpen: true }
      )
    }
  }, [invoice?.id])

  // this function will be called before the Form's onSubmit handler is called
  // and the form must include `cost` or `amount` as a value
  const onSubmitWrapper = useCallback(async (formValues, ...submitArgs) => {
    let { cost, amount } = formValues
    cost ??= amount

    // action only allowed if logged in
    if (!me && options.requireSession) {
      throw new Error('you must be logged in')
    }

    // if no cost is passed, just try the action first
    if (!cost || (me && !options.forceInvoice)) {
      try {
        return await onSubmit(formValues, ...submitArgs)
      } catch (error) {
        if (!payOrLoginError(error)) {
          throw error
        }
      }
    }
    setFormValues(formValues)
    setSubmitArgs(submitArgs)
    await createInvoice({ variables: { amount: cost } })
    // tell onSubmit handler that we want to keep local storage
    // even though the submit handler was "successful"
    return { keepLocalStorage: true }
  }, [onSubmit, setFormValues, setSubmitArgs, createInvoice])

  return onSubmitWrapper
}

export const InvoiceModal = ({ onPayment, amount }) => {
  const createInvoice = useInvoiceable(onPayment, { replaceModal: true })

  useEffect(() => {
    createInvoice({ amount })
  }, [])
}

export const payOrLoginError = (error) => {
  const matches = ['insufficient funds', 'you must be logged in or pay']
  if (Array.isArray(error)) {
    return error.some(({ message }) => matches.some(m => message.includes(m)))
  }
  return matches.some(m => error.toString().includes(m))
}
