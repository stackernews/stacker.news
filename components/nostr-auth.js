import { useEffect, useState, useCallback } from 'react'
import { useToast } from '@/components/toast'
import { gql, useMutation } from '@apollo/client'
import { signIn } from 'next-auth/react'
import Container from 'react-bootstrap/Container'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import AccordianItem from './accordian-item'
import styles from './nostr-auth.module.css'
import { NostrSigner } from '@/lib/nostr'
import { useShowModal } from './modal'
import Button from 'react-bootstrap/Button'
import { Input, Form, SubmitButton } from './form'
import Qr, { QrSkeleton } from './qr'
import CancelButton from './cancel-button'

export function NostrAuth ({ text, callbackUrl }) {
  const [signer, setSigner] = useState(null)
  const [nostrConnectUrl, setNostrConnectUrl] = useState('')
  const [status, setStatus] = useState('')
  const [statusVariant, setStatusVariant] = useState('')
  const toaster = useToast()

  const [createAuth, { data, error }] = useMutation(gql`
    mutation createAuth {
      createAuth {
        k1
      }
    }`, {
    // don't cache this mutation
    fetchPolicy: 'no-cache'
  })

  // print an error message
  const handleError = useCallback((e) => {
    console.error(e)
    toaster.danger(e.message || e.toString())
    setStatus(e.message || e.toString())
    setStatusVariant('failed')
    // clear the error after a while
    // the connection can be retried
    setTimeout(() => {
      setStatus('')
      setStatusVariant('')
    }, 1000)
  }, [])

  // print a progress message with the pending status
  const handleProgress = useCallback((msg) => {
    console.log(msg)
    setStatus(msg)
    setStatusVariant('')
  }, [])

  // Prompt the user to execute a challenge
  const challengeHandler = useCallback(async (challenge, type) => {
    const sanitizeURL = (s) => {
      try {
        const url = new URL(s)
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('invalid protocol')
        return url.href
      } catch (e) {
        return null
      }
    }
    const challengeUrl = sanitizeURL(challenge)
    showModal((onClose) => (
      <div>
        <h2>Waiting for confirmation</h2>
        <p>
          Please confirm this action on your remote signer.
        </p>
        {!challengeUrl && (<pre>{challenge}</pre>)}
        <div className='mt-3'>
          <div className='d-flex justify-content-between'>
            <div className='d-flex align-items-center ms-auto'>
              <CancelButton onClick={onClose} />
              {challengeUrl && (
                <Button
                  variant='primary'
                  onClick={() => {
                    handleProgress('Waiting for challenge')
                    window.open(challengeUrl, '_blank')
                    onClose()
                  }}
                >confirm
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    ))
  }, [])

  // authorize user
  const auth = useCallback(async (preferExt = false) => {
    handleProgress('Waiting for authorization')
    const k1 = data?.createAuth.k1
    if (!k1) throw new Error('Error generating challenge') // should never happen
    const event = {
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['challenge', k1]],
      content: 'Stacker News Authentication'
    }
    const signedEvent = await signer.signEvent(event, preferExt, challengeHandler)
    await signIn('nostr', {
      event: JSON.stringify(signedEvent),
      callbackUrl
    })
  }, [signer])

  // connect app to signer
  const connect = useCallback(async (bunker) => {
    try {
      if (signer && bunker) {
        handleProgress('Connecting to signer')
        await signer.connect(bunker, challengeHandler)
        await auth()
      }
    } catch (e) {
      handleError(e)
    }
  }, [signer])

  // Init auth
  useEffect(() => {
    createAuth()
  }, [])

  // Restart signer on change
  useEffect(() => {
    if (!signer) return
    signer.startListeningForSpontaneousConnections(challengeHandler, async () => {
      try {
        console.log('Received NIP-46 nostrconnect event')
        await auth()
      } catch (e) {
        handleError(e)
      }
    })
    return () => {
      if (signer) {
        signer.close()
      }
    }
  }, [signer])

  // initialize signer
  useEffect(() => {
    if (!data) return
    (async () => {
      try {
        if (signer) signer.close()
      } catch (e) {
        handleError(e)
      }
      try {
        const newSigner = new NostrSigner(
          [22242],
          {
            name: 'Stacker News',
            url: process.env.NEXT_PUBLIC_URL,
            description: 'Login to Stacker News',
            icons: [
              `${process.env.NEXT_PUBLIC_URL}/icons/icon_x128.png`
            ]
          }
        )
        setNostrConnectUrl(newSigner.getNostrConnectUrl())
        setSigner(newSigner)
      } catch (e) {
        handleError(e)
      }
    })()
  }, [data])

  const showModal = useShowModal()

  if (!data) return <QrSkeleton status='generating' />
  if (error) return <div>error</div>

  return (
    <>
      <Row className='w-100 g-1'>
        <Qr
          asIs
          value={nostrConnectUrl}
          className='mw-100'
          status={status}
          statusVariant={statusVariant}
          description={`Use a NIP-46 signer to ${text || 'Login'}  with Nostr`}
        />
        <Button
          disabled={status !== ''}
          variant='primary'
          type='submit'
          className='mt-4'
          onClick={() => {
            showModal((onClose) => (
              <div>
                <h2>Connect</h2>
                <Form
                  initial={{ token: '' }}
                  onSubmit={values => {
                    if (values.token) {
                      connect(values.token)
                      onClose()
                    }
                  }}
                >
                  <Input
                    label='Use a connection token or NIP-05 address'
                    name='token'
                    placeholder='bunker://...  or NIP-05 address'
                    required
                    autoFocus
                  />
                  <div className='mt-3'>
                    <div className='d-flex justify-content-between'>
                      <div className='d-flex align-items-center ms-auto'>
                        <CancelButton onClick={onClose} />
                        <SubmitButton variant='primary'>
                          submit
                        </SubmitButton>
                      </div>
                    </div>
                  </div>
                </Form>
              </div>
            )
            )
          }}
        >
          {text || 'Login'} with token or NIP-05
        </Button>
        <div className='mt-2 text-center text-muted fw-bold'>or</div>
        <Button
          disabled={status !== ''}
          variant='nostr'
          className='w-100'
          type='submit'
          onClick={async () => {
            try {
              await auth(signer, true)
            } catch (e) {
              handleError(e)
            }
          }}
        >
          {text || 'Login'} with extension
        </Button>
      </Row>
      <Row className='w-100 mt-4 text-muted small'>
        <AccordianItem
          header='Which NIP-46 signed can I use?'
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
                      <a href='https://github.com/nostr-connect/nostrum'>Nostrum</a><br />
                      available for: iOS and Android
                    </li>
                    <li>
                      <a href='https://github.com/greenart7c3/amber'>Amber</a><br />
                      available for: Android
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
  )
}

export default function NostrAuthWithExplainer ({ text, callbackUrl }) {
  return (
    <Container className={styles.login}>
      <h3 className='w-100 pb-2'>{text || 'Login'} with Nostr</h3>
      <NostrAuth text={text} callbackUrl={callbackUrl} />
    </Container>
  )
}
