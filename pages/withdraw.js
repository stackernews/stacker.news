import { getGetServerSideProps } from '@/api/ssrApollo'
import { CenterLayout } from '@/components/layout'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { InputGroup, Nav } from 'react-bootstrap'
import styles from '@/styles/nav.module.css'
import { useMutation } from '@apollo/client'
import { CREATE_WITHDRAWL, SEND_TO_LNADDR } from '@/fragments/withdrawal'
import { requestProvider } from 'webln'
import { useEffect, useState, useCallback } from 'react'
import { useMe } from '@/components/me'
import { Checkbox, Form, Input, InputUserSuggest, SubmitButton } from '@/components/form'
import { lnAddrSchema, withdrawlSchema } from '@/lib/validate'
import { useShowModal } from '@/components/modal'
import { useField } from 'formik'
import { useToast } from '@/components/toast'
import { decode } from 'bolt11'
import CameraIcon from '@/svgs/camera-line.svg'
import useDebounceCallback from '@/components/use-debounce-callback'
import { lnAddrOptions } from '@/lib/lnurl'
import AccordianItem from '@/components/accordian-item'
import { numWithUnits } from '@/lib/format'
import PageLoading from '@/components/page-loading'
import dynamic from 'next/dynamic'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Withdraw () {
  return (
    <CenterLayout>
      <WithdrawForm />
    </CenterLayout>
  )
}

function WithdrawForm () {
  const router = useRouter()
  const { me } = useMe()

  return (
    <div className='w-100 d-flex flex-column align-items-center py-5'>
      <h2 className='text-start ms-1 ms-md-3'>
        <div className='text-monospace'>
          {numWithUnits(me?.privates?.sats - me?.privates?.credits, { abbreviate: false, format: true, unitSingular: 'sats', unitPlural: 'sats' })}
        </div>
      </h2>
      <Nav
        className={styles.nav}
        activeKey={router.query.type ?? 'invoice'}
      >
        <Nav.Item>
          <Link href='/withdraw' passHref legacyBehavior>
            <Nav.Link eventKey='invoice'>invoice</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href='/withdraw?type=lnaddr' passHref legacyBehavior>
            <Nav.Link eventKey='lnaddr'>lightning address</Nav.Link>
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
    case 'lnaddr':
      return <LnAddrWithdrawal />
    default:
      return <InvWithdrawal />
  }
}

export function InvWithdrawal () {
  const router = useRouter()
  const { me } = useMe()

  const [createWithdrawl] = useMutation(CREATE_WITHDRAWL)

  const maxFeeDefault = me?.privates?.withdrawMaxFeeDefault
  const [zeroAmount, setZeroAmount] = useState(false)
  const checkInvoice = useCallback((invoice) => {
    try {
      const decoded = decode(invoice)
      setZeroAmount(!decoded.mtokens || BigInt(decoded.mtokens) <= 0)
    } catch {
      setZeroAmount(false)
    }
  }, [])

  useEffect(() => {
    async function effect () {
      try {
        const provider = await requestProvider()
        const { paymentRequest: invoice } = await provider.makeInvoice({
          defaultMemo: `Withdrawal for @${me.name} on SN`,
          maximumAmount: Math.max(me.privates?.sats - maxFeeDefault, 0)
        })
        const { data } = await createWithdrawl({ variables: { invoice, maxFee: maxFeeDefault } })
        router.push(`/transactions/${data.createWithdrawl.id}`)
      } catch (e) {
        console.log(e.message)
      }
    }
    effect()
  }, [])

  return (
    <>
      <Form
        autoComplete='off'
        initial={{
          invoice: '',
          maxFee: maxFeeDefault,
          amount: ''
        }}
        schema={withdrawlSchema}
        onSubmit={async ({ invoice, maxFee, amount }) => {
          const variables = { invoice, maxFee: Number(maxFee) }
          if (zeroAmount) variables.amount = Number(amount)
          const { data } = await createWithdrawl({ variables })
          router.push(`/transactions/${data.createWithdrawl.id}`)
        }}
      >
        <Input
          label='invoice'
          name='invoice'
          required
          autoFocus
          clear
          append={<InvoiceScanner fieldName='invoice' onInvoiceChange={checkInvoice} />}
          onChange={(_, e) => { checkInvoice(e.target.value) }}
        />
        {zeroAmount && (
          <Input
            label='amount (sats)'
            name='amount'
            type='number'
            required
            min={1}
          />
        )}
        <Input
          label='max fee'
          name='maxFee'
          required
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        <div className='d-flex justify-content-end mt-4'>
          <SubmitButton variant='success'>withdraw</SubmitButton>
        </div>
      </Form>
    </>
  )
}

function InvoiceScanner ({ fieldName, onInvoiceChange }) {
  const showModal = useShowModal()
  const [,, helpers] = useField(fieldName)
  const toaster = useToast()
  const Scanner = dynamic(() => import('@yudiel/react-qr-scanner').then(mod => mod.Scanner), {
    ssr: false,
    loading: () => <PageLoading />
  })

  return (
    <InputGroup.Text
      style={{ cursor: 'pointer' }}
      onClick={() => {
        showModal(onClose => {
          return (
            <>
              {Scanner && (
                <Scanner
                  formats={['qr_code']}
                  onScan={([{ rawValue: result }]) => {
                    result = result.toLowerCase()
                    let invoice
                    if (result.includes('lightning=')) {
                      invoice = result.split('lightning=')[1].split(/[&?]/)[0]
                      helpers.setValue(invoice)
                    } else {
                      try {
                        invoice = result.replace(/^lightning:/, '')
                        decode(invoice)
                        helpers.setValue(invoice)
                      } catch {
                        toaster.danger('Not a proper lightning payment request')
                        onClose()
                        return
                      }
                    }
                    if (onInvoiceChange) onInvoiceChange(invoice)
                    onClose()
                  }}
                  styles={{
                    video: {
                      aspectRatio: '1 / 1'
                    }
                  }}
                  onError={(error) => {
                    if (error instanceof DOMException) {
                      console.log(error)
                    } else {
                      toaster.danger('qr scan: ' + error?.message || error?.toString?.())
                    }
                    onClose()
                  }}
                />)}
            </>
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

export function LnAddrWithdrawal () {
  const { me } = useMe()
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
          router.push(`/transactions/${data.sendToLnAddr.id}`)
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
        <div className='d-flex justify-content-end mt-4'>
          <SubmitButton variant='success'>send</SubmitButton>
        </div>
      </Form>
    </>
  )
}
