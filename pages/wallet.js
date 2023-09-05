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
import Nav from 'react-bootstrap/Nav'
import { SSR } from '../lib/constants'
import { numWithUnits } from '../lib/format'
import styles from '../components/user-header.module.css'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Wallet () {
  const router = useRouter()

  if (router.query.type === 'fund') {
    return (
      <CenterLayout>
        <FundForm />
      </CenterLayout>
    )
  } else if (router.query.type?.includes('withdraw')) {
    return (
      <CenterLayout>
        <WithdrawalForm />
      </CenterLayout>
    )
  } else {
    return (
      <CenterLayout>
        <YouHaveSats />
        <WalletForm />
        <WalletHistory />
      </CenterLayout>
    )
  }
}

function YouHaveSats () {
  const me = useMe()
  return (
    <h2 className={`${me ? 'visible' : 'invisible'} text-success`}>
      you have <span className='text-monospace'>{me && numWithUnits(me.sats, { abbreviate: false })}</span>
    </h2>
  )
}

function WalletHistory () {
  return (
    <Link href='/satistics?inc=invoice,withdrawal' className='text-muted fw-bold text-underline'>
      wallet history
    </Link>
  )
}

export function WalletForm () {
  return (
    <div className='align-items-center text-center py-5'>
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
      <div className='w-100 py-5'>
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
      </div>
      <WalletHistory />
    </>
  )
}

export function WithdrawalForm () {
  const router = useRouter()

  return (
    <div className='w-100 d-flex flex-column align-items-center py-5'>
      <YouHaveSats />
      <Nav
        className={styles.nav}
        activeKey={router.query.type}
      >
        <Nav.Item>
          <Link href='/wallet?type=withdraw' passHref legacyBehavior>
            <Nav.Link eventKey='withdraw'>invoice</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href='/wallet?type=lnurl-withdraw' passHref legacyBehavior>
            <Nav.Link eventKey='lnurl-withdraw'>QR code</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href='/wallet?type=lnaddr-withdraw' passHref legacyBehavior>
            <Nav.Link eventKey='lnaddr-withdraw'>lightning address</Nav.Link>
          </Link>
        </Nav.Item>
      </Nav>
      <SelectedWithdrawalForm />
    </div>
  )
}

export function SelectedWithdrawalForm () {
  const router = useRouter()

  switch (router.query.type) {
    case 'withdraw':
      return <InvWithdrawal />
    case 'lnurl-withdraw':
      return <LnWithdrawal />
    case 'lnaddr-withdraw':
      return <LnAddrWithdrawal />
  }
}

const MAX_FEE_DEFAULT = 10

export function InvWithdrawal () {
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
