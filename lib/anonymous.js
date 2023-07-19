import { useMutation, useQuery } from '@apollo/client'
import { GraphQLError } from 'graphql'
import { gql } from 'graphql-tag'
import { useCallback, useEffect, useState } from 'react'
import { useShowModal } from '../components/modal'
import { Invoice as QrInvoice } from '../components/invoice'
import { QrSkeleton } from '../components/qr'
import { useMe } from '../components/me'
import { msatsToSats } from './format'
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

export const useAnonymous = (fn) => {
  const me = useMe()
  const [createInvoice, { data }] = useMutation(gql`
    mutation createInvoice($amount: Int!) {
      createInvoice(amount: $amount) {
        id
      }
    }`)
  const showModal = useShowModal()
  const [fnArgs, setFnArgs] = useState()

  const invoice = data?.createInvoice
  useEffect(() => {
    if (invoice) {
      showModal(onClose =>
        <Invoice
          id={invoice.id}
          onConfirmation={
            async ({ id, satsReceived }) => {
              setTimeout(async () => {
                await fn(satsReceived, ...fnArgs, id)
                onClose()
              }, 2000)
            }
          } successVerb='received'
        />
      )
    }
  }, [invoice?.id])

  const anonFn = useCallback((amount, ...args) => {
    if (me) return fn(amount, ...args)
    setFnArgs(args)
    return createInvoice({ variables: { amount } })
  }, [fn, setFnArgs, createInvoice])

  return anonFn
}

export const checkInvoice = async (models, invoiceId, fee) => {
  const invoice = await models.invoice.findUnique({
    where: { id: Number(invoiceId) },
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
