import { useRouter } from 'next/router'
import { Form, Input, SubmitButton } from '../components/form'
import Link from 'next/link'
import Button from 'react-bootstrap/Button'
import * as Yup from 'yup'
import { gql, useMutation, useQuery } from '@apollo/client'
import { InvoiceSkeleton } from '../components/invoice'
import LayoutCenter from '../components/layout-center'
import InputGroup from 'react-bootstrap/InputGroup'
import { WithdrawlSkeleton } from './withdrawls/[id]'

export default function Wallet () {
  return (
    <LayoutCenter>
      <WalletForm />
    </LayoutCenter>
  )
}

export function WalletForm () {
  const router = useRouter()

  if (!router.query.type) {
    return (
      <div className='align-items-center'>
        <Link href='/wallet?type=fund'>
          <Button variant='success'>fund</Button>
        </Link>
        <span className='mx-3 font-weight-bold text-muted'>or</span>
        <Link href='/wallet?type=withdrawl'>
          <Button variant='success'>withdrawl</Button>
        </Link>
      </div>
    )
  }

  if (router.query.type === 'fund') {
    return <FundForm />
  } else {
    return <WithdrawlForm />
  }
}

export const FundSchema = Yup.object({
  amount: Yup.number().typeError('must be a number').required('required')
    .positive('must be positive').integer('must be whole')
})

export function FundForm () {
  const router = useRouter()
  const [createInvoice, { called, error }] = useMutation(gql`
    mutation createInvoice($amount: Int!) {
      createInvoice(amount: $amount) {
        id
      }
    }`)

  if (called && !error) {
    return <InvoiceSkeleton status='generating' />
  }

  return (
    <Form
      initial={{
        amount: 1000
      }}
      schema={FundSchema}
      onSubmit={async ({ amount }) => {
        const { data } = await createInvoice({ variables: { amount: Number(amount) } })
        router.push(`/invoices/${data.createInvoice.id}`)
      }}
    >
      <Input
        label='amount'
        name='amount'
        required
        autoFocus
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
      />
      <SubmitButton variant='success' className='mt-2'>generate invoice</SubmitButton>
    </Form>
  )
}

export const WithdrawlSchema = Yup.object({
  invoice: Yup.string().required('required'),
  maxFee: Yup.number().typeError('must be a number').required('required')
    .min(0, 'must be positive').integer('must be whole')
})

export function WithdrawlForm () {
  const router = useRouter()
  const query = gql`
  {
    me {
      sats
    }
  }`
  const { data } = useQuery(query, { pollInterval: 1000 })

  const [createWithdrawl, { called, error }] = useMutation(gql`
    mutation createWithdrawl($invoice: String!, $maxFee: Int!) {
      createWithdrawl(invoice: $invoice, maxFee: $maxFee) {
        id
      }
  }`)

  if (called && !error) {
    return <WithdrawlSkeleton status='sending' />
  }

  return (
    <>
      <h2 className={`${data ? 'visible' : 'invisible'} text-success pb-5`}>
        you have <span className='text-monospace'>{data && data.me.sats}</span> sats
      </h2>
      <Form
        className='pt-3'
        initial={{
          invoice: '',
          maxFee: 0
        }}
        initialError={error ? error.toString() : undefined}
        schema={WithdrawlSchema}
        onSubmit={async ({ invoice, maxFee }) => {
          console.log('calling')
          const { data } = await createWithdrawl({ variables: { invoice, maxFee: Number(maxFee) } })
          router.push(`/withdrawls/${data.createWithdrawl.id}`)
        }}
      >
        <Input
          label='invoice'
          name='invoice'
          required
          autoFocus
        />
        <Input
          label='max fee'
          name='maxFee'
          required
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        <SubmitButton variant='success' className='mt-2'>withdrawl</SubmitButton>
      </Form>
    </>
  )
}
