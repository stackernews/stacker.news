import { Nav } from 'react-bootstrap'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@apollo/client'
import { WALLET } from '@/fragments/wallet'
import { WalletLayout, WalletLayoutHeader, WalletLayoutImageOrName } from '@/wallets/client/components'
import { protocolDisplayName, protocolFields, unurlify, urlify } from '@/wallets/client/util'
import styles from '@/styles/wallet.module.css'
import { Form, Input } from '@/components/form'

export function WalletForms ({ name }) {
  // TODO(wallet-v2): support editing a user wallet if id is given
  // TODO(wallet-v2): handle loading and error states
  const { data } = useQuery(WALLET, {
    variables: {
      name
    }
  })
  const wallet = data?.wallet

  return (
    <WalletLayout>
      <div className='py-5'>
        <WalletLayoutHeader>
          <WalletLayoutImageOrName name={name} maxHeight='80px' />
        </WalletLayoutHeader>
        {wallet && <WalletFormSelector wallet={wallet} />}
      </div>
    </WalletLayout>
  )
}

function WalletFormSelector ({ wallet }) {
  const sendRecvParam = useSendRecvParam()
  const protocolParam = useWalletProtocolParam()

  return (
    <>
      <WalletSendRecvSelector wallet={wallet} />
      {sendRecvParam &&
        <WalletProtocolSelector wallet={wallet} />}
      {sendRecvParam && protocolParam &&
        <WalletProtocolForm wallet={wallet} />}
    </>
  )
}

function WalletSendRecvSelector ({ wallet }) {
  const path = useWalletPathname()
  const selected = useSendRecvParam()
  const router = useRouter()

  useEffect(() => {
    if (!selected) {
      router.replace(`/${path}/send`, null, { shallow: true })
    }
  }, [path])

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

function WalletProtocolSelector ({ wallet }) {
  const walletPath = useWalletPathname()
  const sendRecvParam = useSendRecvParam()
  const path = `${walletPath}/${sendRecvParam}`

  const protocols = useWalletProtocols(wallet)
  const selected = useWalletProtocolParam()
  const router = useRouter()

  useEffect(() => {
    if (!selected && protocols.length > 0) {
      router.replace(`/${path}/${urlify(protocols[0].name)}`, null, { shallow: true })
    }
  }, [path])

  if (protocols.length === 0) {
    // TODO(wallet-v2): let user know how to request support if the wallet actually does support sending
    return <div className='text-muted text-center'>sending not supported</div>
  }

  return (
    <Nav
      key={path}
      className={`${styles.nav} justify-content-evenly`}
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

function WalletProtocolForm ({ wallet }) {
  const sendRecvParam = useSendRecvParam()
  const protocolParam = useWalletProtocolParam()
  const send = sendRecvParam === 'send'
  const protocol = wallet.protocols.find(p => p.name === protocolParam && p.send === send)
  if (!protocol) return null

  const { fields, initial, schema } = useProtocolForm({ name: protocolParam, send })

  return (
    <Form
      initial={initial}
      schema={schema}
      onSubmit={values => {
        console.log(values)
      }}
    >
      {fields.map(field => <WalletProtocolFormField key={field.name} {...field} />)}
    </Form>
  )
}

function WalletProtocolFormField ({ type, ...props }) {
  function transform (props) {
    const hint = props.hint ?? (props.required ? null : 'optional')
    return { ...props, hint }
  }

  switch (type) {
    case 'text':
      return <Input {...transform(props)} />
    case 'password':
      return <Input {...transform(props)} type='password' />
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

function useWalletProtocols (wallet) {
  const sendRecvParam = useSendRecvParam()
  if (!sendRecvParam) return []

  const send = sendRecvParam === 'send'
  return wallet.protocols.filter(p => send ? p.send : !p.send)
}

function useProtocolForm (protocol) {
  const fields = protocolFields(protocol)
  const initial = fields.reduce(
    (acc, field) => ({ ...acc, [field.name]: '' }),
    {}
  )

  // TODO(wallet-v2): return validation schema
  return { fields, initial }
}
