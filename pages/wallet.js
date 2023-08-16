import { useRouter } from 'next/router'
import { Form, Input, SubmitButton } from '../components/form'
import Link from 'next/link'
import Button from 'react-bootstrap/Button'
import { gql, useMutation, useQuery } from '@apollo/client'
import Qr, { QrSkeleton } from '../components/qr'
import { CenterLayout } from '../components/layout'
import InputGroup from 'react-bootstrap/InputGroup'
import { WithdrawlSkeleton } from './withdrawals/[id]'
import { useMe } from '../components/me'
import { useEffect, useState } from 'react'
import { requestProvider } from 'webln'
import Alert from 'react-bootstrap/Alert'
import { CREATE_WITHDRAWL, SEND_TO_LNADDR } from '../fragments/wallet'
import { getGetServerSideProps } from '../api/ssrApollo'
import { amountSchema, lnAddrSchema, withdrawlSchema } from '../lib/validate'
import { SSR } from '../lib/constants'
import Tab from 'react-bootstrap/Tab'
import Tabs from 'react-bootstrap/Tabs'
import { numWithUnits } from '../lib/format'

export const getServerSideProps = getGetServerSideProps()

export default function Wallet () {
  return (
    <CenterLayout>
      <WalletForm />
    </CenterLayout>
  )
}

function YouHaveSats () {
  const me = useMe()
  return (
    <>
      <h2 className={`${me ? 'visible' : 'invisible'} text-success`}>
        you have <span className='text-monospace'>{me && numWithUnits(me.sats, { abbreviate: false })}</span>
      </h2>
      <WalletHistory />
    </>
  )
}

function WalletHistory () {
  return (
    <div className='pb-5' style={{ fontWeight: 500 }}>
      <Link href='/satistics?inc=invoice,withdrawal' className='nav-link p-0'>
        wallet history
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
        <span className='mx-3 fw-bold text-muted'>or</span>
        <Link href='/wallet?type=withdraw'>
          <Button variant='success'>withdraw</Button>
        </Link>
      </div>
    )
  }

  if (router.query.type === 'fund') {
    return <FundForm />
  } else {
    return <WithdrawalMethods />
  }
}

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
    setShowAlert(!window.localStorage.getItem('hideLnAddrAlert'))
  }, [])

  if (called && !error) {
    return <QrSkeleton description status='generating' />
  }

  return (
    <>
      <YouHaveSats />
      {me && showAlert &&
        <Alert
          variant='success' dismissible onClose={() => {
            window.localStorage.setItem('hideLnAddrAlert', 'yep')
            setShowAlert(false)
          }}
        >
          You can also fund your account via lightning address with <strong>{`${me.name}@stacker.news`}</strong>
        </Alert>}
      <Form
        initial={{
          amount: 1000
        }}
        initialError={error?.toString()}
        schema={amountSchema}
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
    </>
  )
}

export function WithdrawalMethods () {
  const router = useRouter()

  return (
    <>
      <YouHaveSats />
      <Tabs
        defaultActiveKey={
          router.query.type === 'lnurl-withdraw'
            ? 'qrcode'
            : router.query.type === 'lnaddr-withdraw'
              ? 'lnaddr'
              : 'invoice'
        }
        id='withdrawal-tabs'
        justify
        mountOnEnter
        onSelect={(k, e) => {
          router.replace(
            k === 'qrcode'
              ? '/wallet?type=lnurl-withdraw'
              : k === 'lnaddr'
                ? '/wallet?type=lnaddr-withdraw'
                : '/wallet?type=withdraw')
        }}
      >
        <Tab eventKey='invoice' title='Invoice'>
          <WithdrawlForm />
        </Tab>
        <Tab eventKey='qrcode' title='QR Code'>
          <LnWithdrawal />
        </Tab>
        <Tab eventKey='lnaddr' title='Lightning Address'>
          <LnAddrWithdrawal />
        </Tab>
      </Tabs>
    </>
  )
}

const MAX_FEE_DEFAULT = 10

export function WithdrawlForm () {
  const router = useRouter()
  const me = useMe()

  const [createWithdrawl, { called, error }] = useMutation(CREATE_WITHDRAWL)

  useEffect(() => {
    async function effect () {
      try {
        const provider = await requestProvider()
        const { paymentRequest: invoice } = await provider.makeInvoice({
          defaultMemo: `Withdrawal for @${me.name} on SN`,
          maximumAmount: Math.max(me.sats - MAX_FEE_DEFAULT, 0)
        })
        const { data } = await createWithdrawl({ variables: { invoice, maxFee: MAX_FEE_DEFAULT } })
        router.push(`/withdrawals/${data.createWithdrawl.id}`)
      } catch (e) {
        console.log(e.message)
      }
    }
    effect()
  }, [])

  if (called && !error) {
    return <WithdrawlSkeleton status='sending' />
  }

  return (
    <>
      <Form
        initial={{
          invoice: '',
          maxFee: MAX_FEE_DEFAULT
        }}
        initialError={error ? error.toString() : undefined}
        schema={withdrawlSchema}
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
          clear
        />
        <Input
          label='max fee'
          name='maxFee'
          required
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        <SubmitButton variant='success' className='mt-2'>withdraw</SubmitButton>
      </Form>
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
  const { data } = useQuery(query, SSR ? {} : { pollInterval: 1000, nextFetchPolicy: 'cache-and-network' })

  if (data?.lnWith?.withdrawalId) {
    router.push(`/withdrawals/${data.lnWith.withdrawalId}`)
  }

  return <Qr value={encodedUrl} status='waiting for you' />
}

export function LnWithdrawal () {
  // query for challenge
  const [createWith, { data, error }] = useMutation(gql`
    mutation createWith {
      createWith {
        k1
        encodedUrl
      }
    }`)

  useEffect(() => {
    createWith()
  }, [])

  if (error) return <div>error</div>

  if (!data) {
    return <QrSkeleton status='generating' />
  }

  return <LnQRWith {...data.createWith} />
}

export function LnAddrWithdrawal () {
  const router = useRouter()
  const [sendToLnAddr, { called, error }] = useMutation(SEND_TO_LNADDR)

  if (called && !error) {
    return <WithdrawlSkeleton status='sending' />
  }

  return (
    <>
      <Form
        initial={{
          addr: '',
          amount: 1,
          maxFee: 10
        }}
        schema={lnAddrSchema}
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
