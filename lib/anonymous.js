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

const Invoice = ({ id, ...props }) => {
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
  return <QrInvoice invoice={data.invoice} {...props} />
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

  const invoice = data?.createInvoice
  useEffect(() => {
    if (invoice) {
      // fix for bug where `showModal` runs the code for two modals and thus executes `onSuccess` twice
      let called = false
      showModal(onClose =>
        <Invoice
          id={invoice.id}
          onConfirmation={
            async ({ satsReceived }) => {
              setTimeout(async () => {
                if (called) return
                called = true
                await fn(satsReceived, ...fnArgs, invoice.hash)
                onClose()
              }, 2000)
            }
          } successVerb='received'
        />, { keepOpen: true }
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
