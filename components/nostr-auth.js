import { useState, useCallback, useEffect, useRef } from 'react'
import { gql, useMutation } from '@apollo/client'
import { signIn } from 'next-auth/react'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import { useRouter } from 'next/router'
import AccordianItem from './accordian-item'
import BackIcon from '@/svgs/arrow-left-line.svg'
import { NDKNip46Signer } from '@nostr-dev-kit/ndk'
import { useToast } from '@/components/toast'
import { Button, Container } from 'react-bootstrap'
import { Form, Input, SubmitButton } from '@/components/form'
import Moon from '@/svgs/moon-fill.svg'
import styles from './lightning-auth.module.css'
import Qr from '@/components/qr'
import { generateSecretKey, getPublicKey } from 'nostr-tools'
import Nostr from '@/lib/nostr'
import NostrBunkerLogin from '@/components/nostr-bunker-login'

const sanitizeURL = (s) => {
  try {
    const url = new URL(s)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('invalid protocol')
    return url.href
  } catch (e) {
    return null
  }
}

function NostrError ({ message }) {
  return (
    <>
      <h4 className='fw-bold text-danger pb-1'>error</h4>
      <div className='text-muted pb-4'>{message}</div>
    </>
  )
}

export function NostrAuth ({ text, callbackUrl, multiAuth, enableQRLogin = false, showBunkerLogin = false }) {
  const [status, setStatus] = useState({
    msg: '',
    error: false,
    loading: false,
    title: undefined,
    button: undefined,
    qr: undefined
  })

  const [suggestion, setSuggestion] = useState(null)
  const suggestionTimeout = useRef(null)
  const toaster = useToast()

  const challengeResolver = useCallback(async (challenge) => {
    const challengeUrl = sanitizeURL(challenge)
    if (challengeUrl) {
      setStatus({
        title: 'Waiting for confirmation',
        msg: 'Please confirm this action on your remote signer',
        error: false,
        loading: true,
        button: {
          label: 'open signer',
          action: () => {
            window.open(challengeUrl, '_blank')
          }
        },
        qr: challenge
      })
    } else {
      setStatus({
        title: 'Waiting for confirmation',
        msg: challenge,
        error: false,
        loading: true,
        qr: challenge
      })
    }
  }, [])
  const makeSecret = () => {
    const arr = new Uint8Array(32)
    crypto.getRandomValues(arr)
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
  }
  const makeNostrConnectUri = ({ appPubkey, relays, secret, metadata }) => {
    const relayParams = (relays || []).map(r => `relay=${encodeURIComponent(r)}`).join('&')
    const md = encodeURIComponent(JSON.stringify(metadata || {}))
    return `nostrconnect://${appPubkey}?${relayParams}&secret=${secret}&metadata=${md}`
  }
  const [createAuth] = useMutation(gql`
    mutation createAuth {
      createAuth {
        k1
      }
    }`, {
    // don't cache this mutation
    fetchPolicy: 'no-cache'
  })

  const loginWithQr = useCallback(async () => {
    try {
      setStatus({
        title: 'Scan to connect',
        msg: 'Awaiting signer pairing ...',
        error: false,
        loading: true,
        qr: undefined,
        button: undefined
      })

      const { data, error } = await createAuth()
      if (error) throw error
      const k1 = data?.createAuth.k1
      if (!k1) throw new Error('Error generating challenge')

      const privKey = generateSecretKey()
      const pubkey = getPublicKey(privKey)
      const relays = [
        'wss://relay.nsec.app',
        'wss://relay.nostr.net',
        'wss://nostr.at',
        'wss://nos.lol'
      ]
      const metadata = {
        name: 'stacker.news',
        url: process.env.NEXT_PUBLIC_URL,
        icons: [new URL('/favicon.ico', process.env.NEXT_PUBLIC_URL).toString()]
      }
      const secret = makeSecret()
      const token = makeNostrConnectUri({ appPubkey: pubkey, relays, secret, metadata })

      setStatus(s => ({
        ...s,
        qr: token,
        privKey,
        token,
        k1,
        secret
      }))
    } catch (e) {
      setError(e)
    }
  }, [createAuth])
  // create auth challenge

  // print an error message
  const setError = useCallback((e) => {
    console.error(e)
    toaster.danger(e.message || e.toString())
    setStatus({
      msg: e.message || e.toString(),
      error: true,
      loading: false
    })
  }, [])

  const clearSuggestionTimer = () => {
    if (suggestionTimeout.current) clearTimeout(suggestionTimeout.current)
  }

  const setSuggestionWithTimer = (msg) => {
    clearSuggestionTimer()
    suggestionTimeout.current = setTimeout(() => {
      setSuggestion(msg)
    }, 10_000)
  }

  useEffect(() => {
    return () => {
      clearSuggestionTimer()
    }
  }, [status])

  // authorize user
  const auth = useCallback(async (nip46token) => {
    const { privKey, token, k1, secret } = status
    setStatus({
      msg: 'Waiting for authorization',
      error: false,
      loading: true
    })

    const nostr = new Nostr({ privKey })
    try {
      const signer = nostr.getSigner({ nip46token: token, supportNip07: false, secret })
      if (!signer) throw new Error('Failed to initialize NIP-46 signer')
      if (signer instanceof NDKNip46Signer) {
        signer.once('authUrl', challengeResolver)
      }

      setSuggestionWithTimer('Having trouble? Make sure you used a fresh token or valid NIP-05 address')
      await signer.blockUntilReady()
      clearSuggestionTimer()

      setStatus({
        msg: 'Signing in',
        error: false,
        loading: true,
        qr: token
      })

      const signedEvent = await nostr.sign({
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['challenge', k1],
          ['u', process.env.NEXT_PUBLIC_URL],
          ['method', 'GET']
        ],
        content: 'Stacker News Authentication'
      }, { signer })

      await signIn('nostr', {
        event: JSON.stringify(signedEvent),
        callbackUrl,
        multiAuth
      })
    } catch (e) {
      setError(e)
    }
  }, [status])

  return (
    <>
      {status.error && <NostrError message={status.msg} />}
      {status.loading
        ? (
          <>
            {status.qr
              ? (
                <>
                  <Qr
                    asIs
                    value={status.qr}
                    description='Scan with your Nostr signer'
                    statusVariant='pending'
                    status={status.msg}
                  />
                  {status.button && (
                    <Button
                      className='w-100 mt-2' variant='primary'
                      onClick={() => status.button.action()}
                    >
                      {status.button.label}
                    </Button>
                  )}
                  {suggestion && (
                    <div className='text-muted text-center small pt-2'>{suggestion}</div>
                  )}
                </>
                )
              : (
                <>
                  <div className='text-muted py-4 w-100 line-height-1 d-flex align-items-center gap-2'>
                    <Moon className='spin fill-grey flex-shrink-0' width='30' height='30' />
                    {status.msg}
                  </div>
                  {status.button && (
                    <Button
                      className='w-100' variant='primary'
                      onClick={() => status.button.action()}
                    >
                      {status.button.label}
                    </Button>
                  )}
                  {suggestion && (
                    <div className='text-muted text-center small pt-2'>{suggestion}</div>
                  )}
                </>
                )}
          </>
          )
        : (
          <>
            <Form
              initial={{ token: '' }}
              onSubmit={values => {
                if (!values.token) {
                  setError(new Error('Token or NIP-05 address is required'))
                } else {
                  auth(values.token)
                }
              }}
            >
              <Input
                label='Connect with token or NIP-05 address'
                name='token'
                placeholder='bunker://...  or NIP-05 address'
                required
                autoFocus
              />
              <div className='mt-2'>
                <SubmitButton className='w-100' variant='primary'>
                  {text || 'Login'} with token or NIP-05
                </SubmitButton>
              </div>
            </Form>
            <div className='text-center text-muted fw-bold my-2'>or</div>
            <Button
              variant='nostr'
              className='w-100'
              type='submit'
              onClick={async () => {
                try {
                  await auth()
                } catch (e) {
                  setError(e)
                }
              }}
            >
              {text || 'Login'} with extension
            </Button>
            <div className='text-center text-muted fw-bold my-2'>or</div>
            <Button
              variant='nostr'
              className='w-100'
              onClick={loginWithQr}
            >
              {text || 'Login'} with QR
            </Button>
          </>
          )}
      {enableQRLogin && showBunkerLogin && (
        <div className='mt-3 mb-4 p-3 border rounded bg-light'>
          <NostrBunkerLogin text={text} callbackUrl={callbackUrl} multiAuth={multiAuth} compact />
        </div>
      )}
    </>
  )
}

function NostrExplainer ({ text, children }) {
  const router = useRouter()
  return (
    <Container>
      <div className={styles.login}>
        <div className='w-100 mb-3 text-muted pointer' onClick={() => router.back()}><BackIcon /></div>
        <h3 className='w-100 pb-2'>
          {text || 'Login'} with Nostr
        </h3>
        <Row className='w-100 text-muted'>
          <Col className='ps-0 mb-4' md>
            <AccordianItem
              header='Which NIP-46 signers can I use?'
              body={
                <>
                  <Row>
                    <Col xs>
                      <ul>
                        <li>
                          <a href='https://nsec.app/'>Nsec.app</a>
                          <ul>
                            <li>available for: chrome, firefox, and safari</li>
                          </ul>
                        </li>
                        <li>
                          <a href='https://app.nsecbunker.com/'>nsecBunker</a>
                          <ul>
                            <li>available as: SaaS or self-hosted</li>
                          </ul>
                        </li>
                      </ul>
                    </Col>
                  </Row>
                </>
          }
            />
            <AccordianItem
              header='Which extensions can I use?'
              body={
                <>
                  <Row>
                    <Col>
                      <ul>
                        <li>
                          <a href='https://getalby.com'>Alby</a>
                          <ul>
                            <li>available for: chrome, firefox, and safari</li>
                          </ul>
                        </li>
                        <li>
                          <a href='https://www.getflamingo.org/'>Flamingo</a>
                          <ul>
                            <li>available for: chrome</li>
                          </ul>
                        </li>
                        <li>
                          <a href='https://github.com/fiatjaf/nos2x'>nos2x</a>
                          <ul>
                            <li>available for: chrome</li>
                          </ul>
                        </li>
                        <li>
                          <a href='https://diegogurpegui.com/nos2x-fox/'>nos2x-fox</a>
                          <ul>
                            <li>available for: firefox</li>
                          </ul>
                        </li>
                        <li>
                          <a href='https://github.com/fiatjaf/horse'>horse</a>
                          <ul>
                            <li>available for: chrome</li>
                            <li>supports hardware signing</li>
                          </ul>
                        </li>
                      </ul>
                    </Col>
                  </Row>
                </>
          }
            />
          </Col>
          <Col md className='mx-auto' style={{ maxWidth: '300px' }}>
            {children}
          </Col>
        </Row>
      </div>
    </Container>
  )
}

export function NostrAuthWithExplainer ({ text, callbackUrl, multiAuth, enableQRLogin = false }) {
  return (
    <NostrExplainer text={text}>
      <NostrAuth text={text} callbackUrl={callbackUrl} multiAuth={multiAuth} enableQRLogin={enableQRLogin} />
    </NostrExplainer>
  )
}
