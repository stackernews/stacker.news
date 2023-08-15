import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { Button } from 'react-bootstrap'
import { gql } from 'graphql-tag'
import { numWithUnits } from '../lib/format'
import AccordianItem from './accordian-item'
import Qr, { QrSkeleton } from './qr'
import { CopyInput } from './form'
import { INVOICE } from '../fragments/wallet'
import InvoiceStatus from './invoice-status'
import { useMe } from './me'
import { useShowModal } from './modal'
import { sleep } from '../lib/time'
import FundError, { isInsufficientFundsError } from './fund-error'
import { usePaymentTokens } from './payment-tokens'

export function Invoice ({ invoice, onConfirmation, successVerb }) {
  let variant = 'default'
  let status = 'waiting for you'
  let webLn = true
  if (invoice.confirmedAt) {
    variant = 'confirmed'
    status = `${numWithUnits(invoice.satsReceived, { abbreviate: false })} ${successVerb || 'deposited'}`
    webLn = false
  } else if (invoice.cancelled) {
    variant = 'failed'
    status = 'cancelled'
    webLn = false
  } else if (invoice.expiresAt <= new Date()) {
    variant = 'failed'
    status = 'expired'
    webLn = false
  }

  useEffect(() => {
    if (invoice.confirmedAt) {
      onConfirmation?.(invoice)
    }
  }, [invoice.confirmedAt])

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

const Contacts = ({ invoiceHash, invoiceHmac }) => {
  const subject = `Support request for payment hash: ${invoiceHash}`
  const body = 'Hi, I successfully paid for <insert action> but the action did not work.'
  return (
    <div className='d-flex flex-column justify-content-center mt-2'>
      <div className='w-100'>
        <CopyInput
          label={<>payment token <small className='text-danger fw-normal ms-2'>save this</small></>}
          type='text' placeholder={invoiceHash + '|' + invoiceHmac} readOnly noForm
        />
      </div>
      <div className='d-flex flex-row justify-content-center'>
        <a
          href={`mailto:kk@stacker.news?subject=${subject}&body=${body}`} className='nav-link p-0 d-inline-flex'
          target='_blank' rel='noreferrer'
        >
          e-mail
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a
          href='https://tribes.sphinx.chat/t/stackerzchat' className='nav-link p-0 d-inline-flex'
          target='_blank' rel='noreferrer'
        >
          sphinx
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a
          href='https://t.me/k00bideh' className='nav-link p-0 d-inline-flex'
          target='_blank' rel='noreferrer'
        >
          telegram
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a
          href='https://simplex.chat/contact#/?v=1-2&smp=smp%3A%2F%2F6iIcWT_dF2zN_w5xzZEY7HI2Prbh3ldP07YTyDexPjE%3D%40smp10.simplex.im%2FebLYaEFGjsD3uK4fpE326c5QI1RZSxau%23%2F%3Fv%3D1-2%26dh%3DMCowBQYDK2VuAyEAV086Oj5yCsavWzIbRMCVuF6jq793Tt__rWvCec__viI%253D%26srv%3Drb2pbttocvnbrngnwziclp2f4ckjq65kebafws6g4hy22cdaiv5dwjqd.onion&data=%7B%22type%22%3A%22group%22%2C%22groupLinkId%22%3A%22cZwSGoQhyOUulzp7rwCdWQ%3D%3D%22%7D' className='nav-link p-0 d-inline-flex'
          target='_blank' rel='noreferrer'
        >
          simplex
        </a>
      </div>
    </div>
  )
}

const ActionInvoice = ({ id, hash, hmac, errorCount, repeat, ...props }) => {
  const { data, loading, error } = useQuery(INVOICE, {
    pollInterval: 1000,
    variables: { id }
  })
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
    errorStatus = 'Something still went wrong.\nPlease contact admins for support or to request a refund.'
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
            <div className='d-flex flex-row mt-3 justify-content-center'><Button variant='info' onClick={repeat}>Retry</Button></div>
            <Contacts invoiceHash={hash} invoiceHmac={hmac} />
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
      createInvoice(amount: $amount, expireSecs: 1800) {
        id
        hash
        hmac
      }
    }`)
  const showModal = useShowModal()
  const [fnArgs, setFnArgs] = useState()
  const { addPaymentToken, removePaymentToken } = usePaymentTokens()

  // fix for bug where `showModal` runs the code for two modals and thus executes `onConfirmation` twice
  let errorCount = 0
  const onConfirmation = useCallback(
    (onClose, hmac) => {
      return async ({ id, satsReceived, hash }) => {
        addPaymentToken(hash, hmac, satsReceived)
        await sleep(500)
        const repeat = () =>
          fn(satsReceived, ...fnArgs, hash, hmac)
            .then(() => {
              removePaymentToken(hash, hmac)
            })
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
                  onConfirmation={onConfirmation(onClose, hmac)}
                  successVerb='received'
                  errorCount={errorCount}
                  repeat={repeat}
                />
              ), { keepOpen: true })
            })
        // prevents infinite loop of calling `onConfirmation`
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
          onConfirmation={onConfirmation(onClose, invoice.hmac)}
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
