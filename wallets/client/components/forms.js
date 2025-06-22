import { useEffect, useCallback, useMemo, createContext, useContext } from 'react'
import { Button, Nav } from 'react-bootstrap'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useRouter } from 'next/router'
import { WalletLayout, WalletLayoutHeader, WalletLayoutImageOrName, WalletLogs } from '@/wallets/client/components'
import { protocolDisplayName, protocolFields, protocolClientSchema, unurlify, urlify, isWallet, isTemplate } from '@/wallets/lib/util'
import styles from '@/styles/wallet.module.css'
import { Checkbox, Form, Input, PasswordInput, SubmitButton } from '@/components/form'
import CancelButton from '@/components/cancel-button'
import { useWalletProtocolUpsert, useWalletProtocolRemove, useWalletQuery } from '@/wallets/client/hooks'
import { useToast } from '@/components/toast'

const WalletFormsContext = createContext()

export function WalletForms ({ id, name }) {
  // TODO(wallet-v2): handle loading and error states
  const { data, refetch } = useWalletQuery({ name, id })
  const wallet = data?.wallet

  return (
    <WalletLayout>
      <div className={styles.form}>
        <WalletLayoutHeader>
          {wallet && <WalletLayoutImageOrName name={wallet.name} maxHeight='80px' />}
        </WalletLayoutHeader>
        {wallet && (
          <WalletFormsProvider wallet={wallet} refetch={refetch}>
            <WalletFormSelector />
          </WalletFormsProvider>
        )}
      </div>
    </WalletLayout>
  )
}

function WalletFormsProvider ({ children, wallet, refetch }) {
  const value = useMemo(() => ({ refetch, wallet }), [refetch, wallet])
  return (
    <WalletFormsContext.Provider value={value}>
      {children}
    </WalletFormsContext.Provider>
  )
}

function useWalletRefetch () {
  const { refetch } = useContext(WalletFormsContext)
  return refetch
}

function useWallet () {
  const { wallet } = useContext(WalletFormsContext)
  return wallet
}

function WalletFormSelector () {
  const sendRecvParam = useSendRecvParam()
  const protocolParam = useWalletProtocolParam()

  return (
    <>
      <WalletSendRecvSelector />
      {sendRecvParam && (
        <div className='position-relative'>
          <div>
            <WalletProtocolSelector />
            {protocolParam && <WalletProtocolForm />}
          </div>
        </div>
      )}
    </>
  )
}

function WalletSendRecvSelector () {
  const path = useWalletPathname()
  const selected = useSendRecvParam()

  // TODO(wallet-v2): if you click a nav link again, it will update the URL
  //   but not run the effect again to select the first protocol by default
  return (
    <Nav
      key={path}
      className={styles.nav}
      activeKey={selected}
    >
      <Nav.Item>
        <Link href={`/${path}/send`} passHref legacyBehavior replace>
          <Nav.Link eventKey='send'>SEND</Nav.Link>
        </Link>
      </Nav.Item>
      <Nav.Item>
        <Link href={`/${path}/receive`} passHref legacyBehavior replace>
          <Nav.Link eventKey='receive'>RECEIVE</Nav.Link>
        </Link>
      </Nav.Item>
    </Nav>
  )
}

function WalletProtocolSelector () {
  const walletPath = useWalletPathname()
  const sendRecvParam = useSendRecvParam()
  const path = `${walletPath}/${sendRecvParam}`

  const protocols = useWalletProtocols()
  const selected = useWalletProtocolParam()
  const router = useRouter()

  useEffect(() => {
    if (!selected && protocols.length > 0) {
      router.replace(`/${path}/${urlify(protocols[0].name)}`, null, { shallow: true })
    }
  }, [path])

  if (protocols.length === 0) {
    // TODO(wallet-v2): let user know how to request support if the wallet actually does support sending
    return (
      <div className='mt-2 text-muted text-center'>
        {sendRecvParam === 'send' ? 'sending' : 'receiving'} not supported
      </div>
    )
  }

  return (
    <Nav
      key={path}
      className={`${styles.nav} justify-content-start mt-3 mb-3`}
      activeKey={selected}
    >
      {
        protocols.map(p => (
          <Nav.Item key={p.name}>
            <Link href={`/${path}/${urlify(p.name)}`} passHref legacyBehavior replace>
              <Nav.Link eventKey={p.name}>{protocolDisplayName(p)}</Nav.Link>
            </Link>
          </Nav.Item>
        ))
      }
    </Nav>
  )
}

function WalletProtocolForm () {
  const sendRecvParam = useSendRecvParam()
  const router = useRouter()
  const protocol = useSelectedProtocol()
  if (!protocol) return null

  // I think it is okay to skip this hook if the protocol is not found
  // because we will need to change the URL to get a different protocol
  // so the amount of rendered hooks should stay the same during the lifecycle of this component
  const wallet = useWallet()
  const upsertWalletProtocol = useWalletProtocolUpsert(wallet, protocol)
  const toaster = useToast()
  const refetch = useWalletRefetch()

  const { fields, initial, schema } = useProtocolForm(protocol)

  const onSubmit = useCallback(async values => {
    const upsert = await upsertWalletProtocol(values)
    if (isWallet(wallet)) {
      toaster.success('wallet saved')
      refetch()
      return
    }
    // we just created a new user wallet from a template
    router.replace(`/wallets/${upsert.id}/${sendRecvParam}`, null, { shallow: true })
    toaster.success('wallet attached', { persistOnNavigate: true })
  }, [upsertWalletProtocol, toaster, wallet, router])

  return (
    <>
      <Form
        enableReinitialize
        initial={initial}
        schema={schema}
        onSubmit={onSubmit}
      >
        {fields.map(field => <WalletProtocolFormField key={field.name} {...field} />)}
        <Checkbox name='enabled' label='enabled' disabled={isTemplate(protocol)} />
        <WalletProtocolFormButtons />
      </Form>
      <WalletLogs className='mt-3' protocol={protocol} />
    </>
  )
}

function WalletProtocolFormButtons () {
  const protocol = useSelectedProtocol()
  const removeWalletProtocol = useWalletProtocolRemove(protocol)
  const refetch = useWalletRefetch()
  const router = useRouter()
  const wallet = useWallet()
  const isLastProtocol = wallet.protocols.length === 1

  const onDetach = useCallback(async () => {
    await removeWalletProtocol()
    if (isLastProtocol) {
      router.replace('/wallets', null, { shallow: true })
      return
    }
    refetch()
  }, [removeWalletProtocol, refetch, isLastProtocol, router])

  return (
    <div className='d-flex justify-content-end'>
      {!isTemplate(protocol) && <Button variant='grey-medium' className='me-auto' onClick={onDetach}>detach</Button>}
      <CancelButton>cancel</CancelButton>
      <SubmitButton variant='primary'>{isWallet(wallet) ? 'save' : 'attach'}</SubmitButton>
    </div>
  )
}

function WalletProtocolFormField ({ type, ...props }) {
  function transform ({ validate, encrypt, ...props }) {
    const label = (
      <div className='d-flex align-items-center'>
        {props.label}
        {!props.required && <small className='text-muted ms-2'>optional</small>}
      </div>
    )

    return { ...props, label }
  }

  switch (type) {
    case 'text':
      return <Input {...transform(props)} />
    case 'password':
      return <PasswordInput {...transform(props)} />
    default:
      return null
  }
}

function useWalletPathname () {
  const pathname = usePathname()
  // returns /wallets/:name
  return pathname.split('/').filter(Boolean).slice(0, 2).join('/')
}

function useSendRecvParam () {
  const params = useParams()
  // returns only :send in /wallets/:name/:send
  return ['send', 'receive'].includes(params.slug[1]) ? params.slug[1] : null
}

function useWalletProtocolParam () {
  const params = useParams()
  const name = params.slug[2]
  // returns only :protocol in /wallets/:name/:send/:protocol
  return name ? unurlify(name) : null
}

function useWalletProtocols () {
  const wallet = useWallet()
  const sendRecvParam = useSendRecvParam()
  if (!sendRecvParam) return []

  const protocolFilter = p => sendRecvParam === 'send' ? p.send : !p.send
  return isWallet(wallet)
    ? wallet.template.protocols.filter(protocolFilter)
    : wallet.protocols.filter(protocolFilter)
}

function useSelectedProtocol () {
  const wallet = useWallet()
  const sendRecvParam = useSendRecvParam()
  const protocolParam = useWalletProtocolParam()

  const send = sendRecvParam === 'send'
  let protocol = wallet.protocols.find(p => p.name === protocolParam && p.send === send)
  if (!protocol && isWallet(wallet)) {
    // the protocol was not found as configured, look for it in the template
    protocol = wallet.template.protocols.find(p => p.name === protocolParam && p.send === send)
  }

  return protocol
}

function useProtocolForm (protocol) {
  const fields = protocolFields(protocol)
  const initial = fields.reduce((acc, field) => {
    // wallet templates don't have a config
    const value = protocol.config?.[field.name]
    return {
      ...acc,
      [field.name]: value || ''
    }
  }, { enabled: protocol.enabled })

  const schema = protocolClientSchema(protocol)
  return { fields, initial, schema }
}
