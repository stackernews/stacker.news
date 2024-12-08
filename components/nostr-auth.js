import { useState, useCallback } from 'react'
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
import { Button } from 'react-bootstrap'
import { Form, Input, SubmitButton } from '@/components/form'
import Moon from '@/svgs/moon-fill.svg'
import styles from './login.module.css'

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

export function NostrAuth ({ text, callbackUrl, multiAuth }) {
  const [status, setStatus] = useState({
    msg: '',
    error: false,
    loading: false,
    title: undefined,
    button: undefined
  })
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
        }
      })
    } else {
      setStatus({
        title: 'Waiting for confirmation',
        msg: challenge,
        error: false,
        loading: true
      })
    }
  }, [])

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

  // authorize user
  const auth = useCallback(async (nip46token) => {
    setStatus({
      msg: 'Waiting for authorization',
      error: false,
      loading: true
    })
    try {
      const { data, error } = await createAuth()
      if (error) throw error

      const k1 = data?.createAuth.k1
      if (!k1) throw new Error('Error generating challenge') // should never happen

      const useExtension = !nip46token
      const signer = Nostr.getSigner({ nip46token, supportNip07: useExtension })
      if (!signer && useExtension) throw new Error('No extension found')

      if (signer instanceof NDKNip46Signer) {
        signer.once('authUrl', challengeResolver)
      }

      await signer.blockUntilReady()

      setStatus({
        msg: 'Signing in',
        error: false,
        loading: true
      })

      const signedEvent = await Nostr.sign({
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['challenge', k1]],
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
  }, [])

  return (
    <>
      <h3 className='w-100 pb-2'>{status.title ? status.title : ((text || 'Login') + ' with Nostr')}</h3>
      {status.error && <NostrError message={status.msg} />}
      {status.loading
        ? (
          <>
            <Moon className='spin fill-grey' width='50' height='50' />
            <div className='text-muted pt-4 pb-4 w-100'>{status.msg}</div>
            {status.button && (
              <Button
                className='w-100' variant='primary'
                onClick={() => status.button.action()}
              >
                {status.button.label}
              </Button>
            )}
          </>
          )
        : (
          <>
            <Row className='w-100 g-1'>
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
              <div className='text-center text-muted fw-bold'>or</div>
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
            </Row>
            <Row className='w-100 mt-4 text-muted small'>
              <AccordianItem
                header='Which NIP-46 signers can I use?'
                body={
                  <>
                    <Row>
                      <Col>
                        <ul>
                          <li>
                            <a href='https://nsec.app/'>Nsec.app</a><br />
                            available for: chrome, firefox, and safari
                          </li>
                          <li>
                            <a href='https://app.nsecbunker.com/'>nsecBunker</a><br />
                            available as: SaaS or self-hosted
                          </li>
                        </ul>
                      </Col>
                    </Row>
                  </>
          }
              />
            </Row>
            <Row className='w-100 text-muted small'>
              <AccordianItem
                header='Which extensions can I use?'
                body={
                  <>
                    <Row>
                      <Col>
                        <ul>
                          <li>
                            <a href='https://getalby.com'>Alby</a><br />
                            available for: chrome, firefox, and safari
                          </li>
                          <li>
                            <a href='https://www.getflamingo.org/'>Flamingo</a><br />
                            available for: chrome
                          </li>
                          <li>
                            <a href='https://github.com/fiatjaf/nos2x'>nos2x</a><br />
                            available for: chrome
                          </li>
                          <li>
                            <a href='https://diegogurpegui.com/nos2x-fox/'>nos2x-fox</a><br />
                            available for: firefox
                          </li>
                          <li>
                            <a href='https://github.com/fiatjaf/horse'>horse</a><br />
                            available for: chrome<br />
                            supports hardware signing
                          </li>
                        </ul>
                      </Col>
                    </Row>
                  </>
          }
              />
            </Row>
          </>
          )}
    </>
  )
}

export function NostrAuthWithExplainer ({ text, callbackUrl, multiAuth }) {
  const router = useRouter()
  return (
    <div className={styles.login}>
      <div className='w-100 mb-3 text-muted pointer' onClick={() => router.back()}><BackIcon /></div>
      <NostrAuth text={text} callbackUrl={callbackUrl} multiAuth={multiAuth} />
    </div>
  )
}
