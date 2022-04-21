import { useRouter } from 'next/router'
import { Form, Input, SubmitButton } from '../components/form'
import Link from 'next/link'
import Button from 'react-bootstrap/Button'
import * as Yup from 'yup'
import { gql, useMutation, useQuery } from '@apollo/client'
import LnQR, { LnQRSkeleton } from '../components/lnqr'
import LayoutCenter from '../components/layout-center'
import InputGroup from 'react-bootstrap/InputGroup'
import { WithdrawlSkeleton } from './withdrawals/[id]'
import { useMe } from '../components/me'
import { useEffect, useState } from 'react'
import { requestProvider } from 'webln'
import { Alert } from 'react-bootstrap'
import { CREATE_WITHDRAWL, SEND_TO_LNADDR } from '../fragments/wallet'
import { getGetServerSideProps } from '../api/ssrApollo'

export const getServerSideProps = getGetServerSideProps()

export default function Wallet () {
  return (
    <LayoutCenter>
      <WalletForm />
    </LayoutCenter>
  )
}

function YouHaveSats () {
  const me = useMe()
  return (
    <h2 className={`${me ? 'visible' : 'invisible'} text-success pb-5`}>
      you have <span className='text-monospace'>{me && me.sats}</span> sats
    </h2>
  )
}

function WalletHistory () {
  return (
    <div className='pt-4'>
      <Link href='/satistics?inc=invoice,withdrawal' passHref>
        <a className='text-muted font-weight-bold text-underline'>wallet history</a>
      </Link>
    </div>
  )
}

export function WalletForm () {
  const router = useRouter()

  if (!router.query.type) {
    return (
      <div className='align-items-center text-center'>
        <YouHaveSats />
        <Link href='/wallet?type=fund'>
          <Button variant='success'>fund</Button>
        </Link>
        <span className='mx-3 font-weight-bold text-muted'>or</span>
        <Link href='/wallet?type=withdraw'>
          <Button variant='success'>withdraw</Button>
        </Link>
        <WalletHistory />
      </div>
    )
  }

  if (router.query.type === 'fund') {
    return <FundForm />
  } else if (router.query.type === 'withdraw') {
    return <WithdrawlForm />
  } else if (router.query.type === 'lnurl-withdraw') {
    return <LnWithdrawal />
  } else {
    return <LnAddrWithdrawal />
  }
}

export const FundSchema = Yup.object({
  amount: Yup.number().typeError('must be a number').required('required')
    .positive('must be positive').integer('must be whole')
})

export function FundForm () {
  const me = useMe()
  const [showAlert, setShowAlert] = useState(true)
  const router = useRouter()
  const [createInvoice, { called, error }] = useMutation(gql`
    mutation createInvoice($amount: Int!) {
      createInvoice(amount: $amount) {
        id
      }
    }`)

  useEffect(() => {
    setShowAlert(!localStorage.getItem('hideLnAddrAlert'))
  }, [])

  if (called && !error) {
    return <LnQRSkeleton status='generating' />
  }

  return (
    <>
      <YouHaveSats />
      {me && showAlert &&
        <Alert
          variant='success' dismissible onClose={() => {
            localStorage.setItem('hideLnAddrAlert', 'yep')
            setShowAlert(false)
          }}
        >
          You can also fund your account via lightning address with <strong>{`${me.name}@stacker.news`}</strong>
        </Alert>}
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
      <WalletHistory />
    </>
  )
}

export const WithdrawlSchema = Yup.object({
  invoice: Yup.string().required('required'),
  maxFee: Yup.number().typeError('must be a number').required('required')
    .min(0, 'must be positive').integer('must be whole')
})

const MAX_FEE_DEFAULT = 10

export function WithdrawlForm () {
  const router = useRouter()
  const me = useMe()

  const [createWithdrawl, { called, error }] = useMutation(CREATE_WITHDRAWL)

  useEffect(async () => {
    try {
      const provider = await requestProvider()
      const { paymentRequest: invoice } = await provider.makeInvoice({
        defaultMemo: `Withdrawal for @${me.name} on SN`
      })
      const { data } = await createWithdrawl({ variables: { invoice, maxFee: MAX_FEE_DEFAULT } })
      router.push(`/withdrawals/${data.createWithdrawl.id}`)
    } catch (e) {
      console.log(e.message)
    }
  }, [])

  if (called && !error) {
    return <WithdrawlSkeleton status='sending' />
  }

  return (
    <>
      <YouHaveSats />
      <Form
        initial={{
          invoice: '',
          maxFee: MAX_FEE_DEFAULT
        }}
        initialError={error ? error.toString() : undefined}
        schema={WithdrawlSchema}
        onSubmit={async ({ invoice, maxFee }) => {
          const { data } = await createWithdrawl({ variables: { invoice, maxFee: Number(maxFee) } })
          router.push(`/withdrawals/${data.createWithdrawl.id}`)
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
        <SubmitButton variant='success' className='mt-2'>withdraw</SubmitButton>
      </Form>
      <span className='my-3 font-weight-bold text-muted'>or via</span>
      <Link href='/wallet?type=lnurl-withdraw'>
        <Button variant='grey'>QR code</Button>
      </Link>
      <Link href='/wallet?type=lnaddr-withdraw'>
        <Button className='mt-2' variant='grey'>Lightning Address</Button>
      </Link>
      <WalletHistory />
    </>
  )
}

function LnQRWith ({ k1, encodedUrl }) {
  const router = useRouter()
  const query = gql`
  {
    lnWith(k1: "${k1}") {
      withdrawalId
      k1
    }
  }`
  const { data } = useQuery(query, { pollInterval: 1000, fetchPolicy: 'cache-first' })

  if (data?.lnWith?.withdrawalId) {
    router.push(`/withdrawals/${data.lnWith.withdrawalId}`)
  }

  return <LnQR value={encodedUrl} status='waiting for you' />
}

export function LnWithdrawal () {
  // query for challenge
  const [createAuth, { data, error }] = useMutation(gql`
    mutation createAuth {
      createWith {
        k1
        encodedUrl
      }
    }`)

  useEffect(createAuth, [])

  if (error) return <div>error</div>

  if (!data) {
    return <LnQRSkeleton status='generating' />
  }

  return <LnQRWith {...data.createWith} />
}

export const LnAddrSchema = Yup.object({
  // addr: Yup.string().email('address is no good').required('required'),
  amount: Yup.number().typeError('must be a number').required('required')
    .positive('must be positive').integer('must be whole'),
  maxFee: Yup.number().typeError('must be a number').required('required')
    .min(0, 'must be positive').integer('must be whole')
})

export function LnAddrWithdrawal () {
  const router = useRouter()
  const [sendToLnAddr, { called, error }] = useMutation(SEND_TO_LNADDR)

  if (called && !error) {
    return <WithdrawlSkeleton status='sending' />
  }

  return (
    <>
      <YouHaveSats />
      <Form
        initial={{
          addr: '',
          amount: 1,
          maxFee: 10
        }}
        schema={LnAddrSchema}
        initialError={error ? error.toString() : undefined}
        onSubmit={async ({ addr, amount, maxFee }) => {
          const { data } = await sendToLnAddr({ variables: { addr, amount: Number(amount), maxFee: Number(maxFee) } })
          router.push(`/withdrawals/${data.sendToLnAddr.id}`)
        }}
      >
        <Input
          label='lightning address'
          name='addr'
          required
          autoFocus
        />
        <Input
          label='amount'
          name='amount'
          required
          autoFocus
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        <Input
          label='max fee'
          name='maxFee'
          required
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        <SubmitButton variant='success' className='mt-2'>send</SubmitButton>
      </Form>
    </>
  )
}
