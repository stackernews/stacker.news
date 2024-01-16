import { useRouter } from 'next/router'
import { Checkbox, Form, Input, InputUserSuggest, SubmitButton } from '../components/form'
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
import { BALANCE_LIMIT_MSATS, SSR } from '../lib/constants'
import { msatsToSats, numWithUnits } from '../lib/format'
import styles from '../components/user-header.module.css'
import HiddenWalletSummary from '../components/hidden-wallet-summary'
import AccordianItem from '../components/accordian-item'
import { lnAddrOptions } from '../lib/lnurl'
import useDebounceCallback from '../components/use-debounce-callback'
import { QrScanner } from '@yudiel/react-qr-scanner'
import CameraIcon from '../svgs/camera-line.svg'
import { useShowModal } from '../components/modal'
import { useField } from 'formik'
import { useToast } from '../components/toast'
import { WalletLimitBanner } from '../components/banners'
import Plug from '../svgs/plug.svg'
import { decode } from 'bolt11'

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
        <WalletLimitBanner />
        <WalletForm />
        <WalletHistory />
      </CenterLayout>
    )
  }
}

function YouHaveSats () {
  const me = useMe()
  const limitReached = me?.privates?.sats >= msatsToSats(BALANCE_LIMIT_MSATS)
  return (
    <h2 className={`${me ? 'visible' : 'invisible'} ${limitReached ? 'text-warning' : 'text-success'}`}>
      you have{' '}
      <span className='text-monospace'>{me && (
        me.privates?.hideWalletBalance
          ? <HiddenWalletSummary />
          : numWithUnits(me.privates?.sats, { abbreviate: false, format: true })
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
    <div className='align-items-center text-center pt-5 pb-4'>
      <Link href='/wallet?type=fund'>
        <Button variant='success'>fund</Button>
      </Link>
      <span className='mx-3 fw-bold text-muted'>or</span>
      <Link href='/wallet?type=withdraw'>
        <Button variant='success'>withdraw</Button>
      </Link>
      <div className='mt-5'>
        <Link href='/settings/wallets'>
          <Button variant='info'>attach wallets <Plug className='fill-white ms-1' width={16} height={16} /></Button>
        </Link>
      </div>
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
      <WalletLimitBanner />
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

export function InvWithdrawal () {
  const router = useRouter()
  const me = useMe()

  const [createWithdrawl, { called, error }] = useMutation(CREATE_WITHDRAWL)

  const maxFeeDefault = me?.privates?.withdrawMaxFeeDefault

  useEffect(() => {
    async function effect () {
      try {
        const provider = await requestProvider()
        const { paymentRequest: invoice } = await provider.makeInvoice({
          defaultMemo: `Withdrawal for @${me.name} on SN`,
          maximumAmount: Math.max(me.privates?.sats - maxFeeDefault, 0)
        })
        const { data } = await createWithdrawl({ variables: { invoice, maxFee: maxFeeDefault } })
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
        autoComplete='off'
        initial={{
          invoice: '',
          maxFee: maxFeeDefault
        }}
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
          append={<InvoiceScanner fieldName='invoice' />}
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

function InvoiceScanner ({ fieldName }) {
  const showModal = useShowModal()
  const [,, helpers] = useField(fieldName)
  const toaster = useToast()
  return (
    <InputGroup.Text
      style={{ cursor: 'pointer' }}
      onClick={() => {
        showModal(onClose => {
          return (
            <QrScanner
              onDecode={(result) => {
                if (result.split('lightning=')[1]) {
                  helpers.setValue(result.split('lightning=')[1].split(/[&?]/)[0].toLowerCase())
                } else if (decode(result.replace(/^lightning:/, ''))) {
                  helpers.setValue(result.replace(/^lightning:/, '').toLowerCase())
                } else {
                  throw new Error('Not a proper lightning payment request')
                }
                onClose()
              }}
              onError={(error) => {
                if (error instanceof DOMException) {
                  console.log(error)
                } else {
                  toaster.danger(error?.message || error?.toString?.())
                }
                onClose()
              }}
            />
          )
        })
      }}
    >
      <CameraIcon
        height={20} width={20} fill='var(--bs-body-color)'
      />
    </InputGroup.Text>
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
  const toaster = useToast()

  useEffect(() => {
    createWith().catch(e => {
      toaster.danger(e?.message || e?.toString?.())
    })
  }, [createWith, toaster])

  if (error) return <QrSkeleton status='error' />

  if (!data) {
    return <QrSkeleton status='generating' />
  }

  return <LnQRWith {...data.createWith} />
}

export function LnAddrWithdrawal () {
  const me = useMe()
  const router = useRouter()
  const [sendToLnAddr, { called, error }] = useMutation(SEND_TO_LNADDR)
  const defaultOptions = { min: 1 }
  const [addrOptions, setAddrOptions] = useState(defaultOptions)
  const [formSchema, setFormSchema] = useState(lnAddrSchema())
  const maxFeeDefault = me?.privates?.withdrawMaxFeeDefault

  const onAddrChange = useDebounceCallback(async (formik, e) => {
    if (!e?.target?.value) {
      setAddrOptions(defaultOptions)
      setFormSchema(lnAddrSchema())
      return
    }

    let options
    try {
      options = await lnAddrOptions(e.target.value)
      setAddrOptions(options)
      setFormSchema(lnAddrSchema(options))
    } catch (e) {
      console.log(e)
      setAddrOptions(defaultOptions)
      setFormSchema(lnAddrSchema())
    }
  }, 500, [setAddrOptions, setFormSchema])

  return (
    <>
      {called && !error && <WithdrawlSkeleton status='sending' />}
      <Form
        // hide/show instead of add/remove from react tree to avoid re-initializing the form state on error
        style={{ display: !(called && !error) ? 'block' : 'none' }}
        initial={{
          addr: '',
          amount: 1,
          maxFee: maxFeeDefault,
          comment: '',
          identifier: false,
          name: '',
          email: ''
        }}
        schema={formSchema}
        onSubmit={async ({ amount, maxFee, ...values }) => {
          const { data } = await sendToLnAddr({
            variables: {
              amount: Number(amount),
              maxFee: Number(maxFee),
              ...values
            }
          })
          router.push(`/withdrawals/${data.sendToLnAddr.id}`)
        }}
      >
        <InputUserSuggest
          label='lightning address'
          name='addr'
          required
          autoFocus
          onChange={onAddrChange}
          transformUser={user => ({ ...user, name: `${user.name}@stacker.news` })}
          selectWithTab
          filterUsers={(query) => {
            const [, domain] = query.split('@')
            return !domain || 'stacker.news'.startsWith(domain)
          }}
        />
        <Input
          label='amount'
          name='amount'
          type='number'
          step={10}
          required
          min={addrOptions.min}
          max={addrOptions.max}
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        <Input
          label='max fee'
          name='maxFee'
          type='number'
          step={10}
          required
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        {(addrOptions?.commentAllowed || addrOptions?.payerData) &&
          <div className='my-3 border border-3 rounded'>
            <div className='p-3'>
              <AccordianItem
                show
                header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>attach</div>}
                body={
                  <>
                    {addrOptions.commentAllowed &&
                      <Input
                        as='textarea'
                        label={<>comment <small className='text-muted ms-2'>optional</small></>}
                        name='comment'
                        maxLength={addrOptions.commentAllowed}
                      />}
                    {addrOptions.payerData?.identifier &&
                      <Checkbox
                        name='identifier'
                        required={addrOptions.payerData.identifier.mandatory}
                        label={
                          <>your {me?.name}@stacker.news identifier
                            {!addrOptions.payerData.identifier.mandatory &&
                              <>{' '}<small className='text-muted ms-2'>optional</small></>}
                          </>
}
                      />}
                    {addrOptions.payerData?.name &&
                      <Input
                        name='name'
                        required={addrOptions.payerData.name.mandatory}
                        label={
                          <>name{!addrOptions.payerData.name.mandatory &&
                            <>{' '}<small className='text-muted ms-2'>optional</small></>}
                          </>
}
                      />}
                    {addrOptions.payerData?.email &&
                      <Input
                        name='email'
                        required={addrOptions.payerData.email.mandatory}
                        label={
                          <>
                            email{!addrOptions.payerData.email.mandatory &&
                              <>{' '}<small className='text-muted ms-2'>optional</small></>}
                          </>
}
                      />}
                  </>
                }
              />
            </div>
          </div>}
        <SubmitButton variant='success' className='mt-2'>send</SubmitButton>
      </Form>
    </>
  )
}
