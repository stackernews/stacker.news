import { useMutation, useQuery } from '@apollo/client'
import { GraphQLError } from 'graphql'
import { gql } from 'graphql-tag'
import { useCallback, useEffect, useState } from 'react'
import { useShowModal } from '../components/modal'
import { Invoice as QrInvoice } from '../components/invoice'
import { QrSkeleton } from '../components/qr'
import { useMe } from '../components/me'
import { msatsToSats } from './format'
import FundError from '../components/fund-error'
import { INVOICE } from '../fragments/wallet'
import InvoiceStatus from '../components/invoice-status'
import { sleep } from './time'
import { Button } from 'react-bootstrap'
import { CopyInput } from '../components/form'

const Contacts = ({ invoiceHash }) => {
  const subject = `Support request for payment hash: ${invoiceHash}`
  const body = 'Hi, I successfully paid for <insert action> but the action did not work.'
  return (
    <div className='d-flex flex-column justify-content-center'>
      <span>Payment hash</span>
      <div className='w-100'>
        <CopyInput type='text' placeholder={invoiceHash} readOnly noForm />
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

const Invoice = ({ id, hash, errorCount, repeat, ...props }) => {
  const { data, loading, error } = useQuery(INVOICE, {
    pollInterval: 1000,
    variables: { id }
  })
  if (error) {
    console.log(error)
    return <div>error</div>
  }
  if (!data || loading) {
    return <QrSkeleton status='loading' />
  }

  let errorStatus = 'Something went wrong. Please try again.'
  if (errorCount > 1) {
    errorStatus = 'Something still went wrong.\nPlease contact admins for support or to request a refund.'
  }
  return (
    <>
      <QrInvoice invoice={data.invoice} {...props} />
      {errorCount > 0
        ? (
          <>
            <InvoiceStatus variant='failed' status={errorStatus} />
            {errorCount === 1
              ? <div className='d-flex flex-row mt-3 justify-content-center'><Button variant='info' onClick={repeat}>Retry</Button></div>
              : <Contacts invoiceHash={hash} />}
          </>
          )
        : null}
    </>
  )
}

const defaultOptions = {
  forceInvoice: false
}
export const useAnonymous = (fn, options = defaultOptions) => {
  const me = useMe()
  const [createInvoice, { data }] = useMutation(gql`
    mutation createInvoice($amount: Int!) {
      createInvoice(amount: $amount) {
        id
        hash
      }
    }`)
  const showModal = useShowModal()
  const [fnArgs, setFnArgs] = useState()

  // fix for bug where `showModal` runs the code for two modals and thus executes `onConfirmation` twice
  let called = false
  let errorCount = 0
  const onConfirmation = useCallback(
    onClose => {
      called = false
      return async ({ id, satsReceived, hash }) => {
        if (called) return
        called = true
        await sleep(2000)
        const repeat = () =>
          fn(satsReceived, ...fnArgs, hash)
            .then(onClose)
            .catch((error) => {
              console.error(error)
              errorCount++
              onClose()
              showModal(onClose => (
                <Invoice
                  id={id}
                  hash={hash}
                  onConfirmation={onConfirmation(onClose)}
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
        <Invoice
          id={invoice.id}
          hash={invoice.hash}
          onConfirmation={onConfirmation(onClose)}
          successVerb='received'
        />
      ), { keepOpen: true }
      )
    }
  }, [invoice?.id])

  const anonFn = useCallback(async (amount, ...args) => {
    if (me && !options.forceInvoice) {
      try {
        return await fn(amount, ...args)
      } catch (error) {
        if (error.toString().includes('insufficient funds')) {
          showModal(onClose => {
            return (
              <FundError
                onClose={onClose}
                amount={amount}
                onPayment={async (_, invoiceHash) => { await fn(amount, ...args, invoiceHash) }}
              />
            )
          })
          return
        }
        throw new Error({ message: error.toString() })
      }
    }
    setFnArgs(args)
    return createInvoice({ variables: { amount } })
  }, [fn, setFnArgs, createInvoice])

  return anonFn
}

export const checkInvoice = async (models, invoiceHash, fee) => {
  const invoice = await models.invoice.findUnique({
    where: { hash: invoiceHash },
    include: {
      user: true
    }
  })
  if (!invoice) {
    throw new GraphQLError('invoice not found', { extensions: { code: 'BAD_INPUT' } })
  }
  if (!invoice.msatsReceived) {
    throw new GraphQLError('invoice was not paid', { extensions: { code: 'BAD_INPUT' } })
  }
  if (msatsToSats(invoice.msatsReceived) < fee) {
    throw new GraphQLError('invoice amount too low', { extensions: { code: 'BAD_INPUT' } })
  }
  return invoice
}
