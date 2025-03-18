import { useState, useCallback, useEffect, useRef } from 'react'
import { gql, useMutation } from '@apollo/client'
import { signIn } from 'next-auth/react'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import { useRouter } from 'next/router'
import AccordianItem from './accordian-item'
import BackIcon from '@/svgs/arrow-left-line.svg'
import Nostr from '@/lib/nostr'
import { NDKNip46Signer } from '@nostr-dev-kit/ndk'
import { useToast } from '@/components/toast'
import { Button, Container } from 'react-bootstrap'
import { Form, Input, SubmitButton } from '@/components/form'
import Moon from '@/svgs/moon-fill.svg'
import styles from './lightning-auth.module.css'
import { useShowModal } from '@/components/modal'

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

export function useNostrAuthState ({
  challengeTitle = 'Waiting for confirmation',
  challengeMessage = 'Please confirm this action on your remote signer',
  challengeButtonLabel = 'open signer'
} = {}) {
  const toaster = useToast()

  const [status, setStatus] = useState({
    msg: '',
    error: false,
    loading: false,
    title: undefined,
    button: undefined
  })

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

  const challengeResolver = useCallback(async (challenge) => {
    const challengeUrl = sanitizeURL(challenge)
    if (challengeUrl) {
      setStatus({
        title: challengeTitle,
        msg: challengeMessage,
        error: false,
        loading: true,
        button: {
          label: challengeButtonLabel,
          action: () => {
            window.open(challengeUrl, '_blank')
          }
        }
      })
    } else {
      setStatus({
        title: challengeTitle,
        msg: challenge,
        error: false,
        loading: true
      })
    }
  }, [])

  return { status, setStatus, setError, challengeResolver }
}

export function useNostrAuthStateModal ({
  ...args
}) {
  const showModal = useShowModal()

  const { status, setStatus, setError, challengeResolver } = useNostrAuthState(args)
  const closeModalRef = useRef(null)

  useEffect(() => {
    closeModalRef?.current?.()
    if (status.loading) {
      showModal(onClose => {
        closeModalRef.current = onClose
        return (
          <>
            <h3 className='w-100 pb-2'>{status.title}</h3>
            <NostrAuthStatus status={status} />
          </>
        )
      })
    }
  }, [status])

  return { status, setStatus, setError, challengeResolver }
}

export function NostrAuthStatus ({ status, suggestion }) {
  return (
    <>
      {status.error && <NostrError message={status.msg} />}
      {status.loading &&
      (
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
}

export function NostrAuth ({ text, callbackUrl, multiAuth }) {
  const { status, setStatus, setError, challengeResolver } = useNostrAuthState()

  const [suggestion, setSuggestion] = useState(null)
  const suggestionTimeout = useRef(null)

  // create auth challenge
  const [createAuth] = useMutation(gql`
    mutation createAuth {
      createAuth {
        k1
      }
    }`, {
    // don't cache this mutation
    fetchPolicy: 'no-cache'
  })

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
  }, [])

  // authorize user
  const auth = useCallback(async (nip46token) => {
    setStatus({
      msg: 'Waiting for authorization',
      error: false,
      loading: true
    })

    const nostr = new Nostr()
    try {
      const { data, error } = await createAuth()
      if (error) throw error

      const k1 = data?.createAuth.k1
      if (!k1) throw new Error('Error generating challenge') // should never happen

      const useExtension = !nip46token
      const signer = nostr.getSigner({ nip46token, nip07: useExtension })
      if (!signer && useExtension) throw new Error('No extension found')

      if (signer instanceof NDKNip46Signer) {
        signer.once('authUrl', challengeResolver)
      }

      setSuggestionWithTimer('Having trouble? Make sure you used a fresh token or valid NIP-05 address')
      await signer.blockUntilReady()
      clearSuggestionTimer()

      setStatus({
        msg: 'Signing in',
        error: false,
        loading: true
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
    } finally {
      nostr.close()
      clearSuggestionTimer()
    }
  }, [])

  return (
    <>
      <NostrAuthStatus status={status} suggestion={suggestion} />
      {!status.loading && (
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
        </>
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

export function NostrAuthWithExplainer ({ text, callbackUrl, multiAuth }) {
  return (
    <NostrExplainer text={text}>
      <NostrAuth text={text} callbackUrl={callbackUrl} multiAuth={multiAuth} />
    </NostrExplainer>
  )
}
