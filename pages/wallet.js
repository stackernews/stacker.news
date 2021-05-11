import { useRouter } from 'next/router'
import { Form, Input, SubmitButton } from '../components/form'
import Link from 'next/link'
import Button from 'react-bootstrap/Button'
import * as Yup from 'yup'
import { gql, useMutation } from '@apollo/client'
import { InvoiceSkeleton } from '../components/invoice'
import LayoutCenter from '../components/layout-center'

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
  amount: Yup.number('must be a number').required('required').positive('must be positive').integer('must be whole')
})

export function FundForm () {
  const router = useRouter()
  const [createInvoice, { called }] = useMutation(gql`
    mutation createInvoice($amount: Int!) {
      createInvoice(amount: $amount) {
        id
      }
    }`)

  if (called) {
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
        append='sats'
      />
      <SubmitButton variant='success' className='mt-2'>generate invoice</SubmitButton>
    </Form>
  )
}

export function WithdrawlForm () {
  return <div>withdrawl</div>
}
