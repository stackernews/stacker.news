import { useRouter } from 'next/router'
import { Checkbox, Form, Input, SubmitButton } from '../components/form'
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
import HiddenWalletSummary from '../components/hidden-wallet-summary'

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
      you have{' '}
      <span className='text-monospace'>{me && (
        me.hideWalletBalance
          ? <HiddenWalletSummary />
          : numWithUnits(me.sats, { abbreviate: false, format: true })
      )}
      </span>
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
  const [min, setMin] = useState(1)
  const [max, setMax] = useState()
  const [commentAllowed, setCommentAllowed] = useState()
  const [payerData, setPayerData] = useState({})

  if (called && !error) {
    return <WithdrawlSkeleton status='sending' />
  }

  const onAddrChange = async (formik, e) => {
    const addr = e.target.value
    try {
      await lnAddrSchema.fields.addr.validate(addr)
    } catch (e) {
      // invalid ln addr, don't proceed
      return
    }

    const [name, domain] = addr.split('@')
    let req
    try {
      req = await fetch(`https://${domain}/.well-known/lnurlp/${name}`)
    } catch (e) {
      // failed to fetch, eat it
      return
    }
    let res
    try {
      res = await req.json()
    } catch (e) {
      // failed to parse to json, eat it
      return
    }
    if (res.status === 'ERROR') {
      // error response, we can't extract anything useful from it
      return
    }
    const { minSendable, maxSendable, commentAllowed, payerData } = res
    setMin(minSendable * 1000)
    setMax(maxSendable * 1000)
    setCommentAllowed(commentAllowed)
    setPayerData(payerData)

    // clear comment if the provider doesn't support them
    if (!commentAllowed) {
      formik.setValues({ comment: '' })
    }

    // set includeIdentifier to false if not supported by the provider
    if (!payerData?.identifier) {
      formik.setValues({ includeIdentifier: false })
    }

    // clear name if the provider doesn't support it
    if (!payerData?.name) {
      formik.setValues({ name: '' })
    }

    // clear email if the provider doesn't support it
    if (!payerData?.email) {
      formik.setValues({ email: '' })
    }
  }

  return (
    <>
      <Form
        initial={{
          addr: '',
          amount: 1,
          maxFee: 10,
          comment: '',
          includeIdentifier: false,
          name: '',
          email: ''
        }}
        schema={lnAddrSchema}
        initialError={error ? error.toString() : undefined}
        onSubmit={async ({ addr, amount, maxFee, comment, includeIdentifier, name, email }) => {
          const { data } = await sendToLnAddr({
            variables: {
              addr,
              amount: Number(amount),
              maxFee: Number(maxFee),
              comment,
              includeIdentifier,
              name,
              email
            }
          })
          router.push(`/withdrawals/${data.sendToLnAddr.id}`)
        }}
      >
        <Input
          label='lightning address'
          name='addr'
          required
          autoFocus
          onChange={onAddrChange}
        />
        <Input
          label='amount'
          name='amount'
          required
          min={min}
          max={max}
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        <Input
          label='max fee'
          name='maxFee'
          required
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        {commentAllowed &&
          <Input
            label={<>comment <small className='text-muted ms-2'>optional</small></>}
            name='comment'
            maxLength={commentAllowed}
          />}
        {payerData?.identifier &&
          <Checkbox
            name='includeIdentifier'
            required={payerData.identifier.mandatory}
            label={<>include your nym@stacker.news identifier{!payerData.name.identifier && <>{' '}<small className='text-muted ms-2'>optional</small></>}</>}
          />}
        {payerData?.name &&
          <Input
            name='name'
            required={payerData.name.mandatory}
            label={<>attach your name to the payment{!payerData.name.mandatory && <>{' '}<small className='text-muted ms-2'>optional</small></>}</>}
          />}
        {payerData?.email &&
          <Input
            name='email'
            required={payerData.email.mandatory}
            label={<>attach your email to the payment{!payerData.email.mandatory && <>{' '}<small className='text-muted ms-2'>optional</small></>}</>}
          />}
        <SubmitButton variant='success' className='mt-2'>send</SubmitButton>
      </Form>
    </>
  )
}
