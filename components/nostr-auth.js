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
import Qr from './qr'
import CancelButton from './cancel-button'

export function NostrAuth ({ text, callbackUrl }) {
  const [signer, setSigner] = useState(null)
  const [nostrConnect, setNostrConnect] = useState('')
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

  useEffect(() => {
    createAuth()
    if (error) {
      toaster.danger('auth failed')
    }
  }, [])

  const k1 = data?.createAuth.k1

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
        <h2>Challenge Request</h2>
        <p>
          The remote signer is requesting you to confirm this action.
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
                    window.open(challengeUrl, '_blank')
                  }}
                >Confirm
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
  }, [k1, signer])

  // connect app to signer
  const connect = useCallback(async (bunker) => {
    try {
      if (signer && bunker) {
        await signer.connectApp(bunker, challengeHandler)
        await auth()
      }
    } catch (e) {
      toaster.danger(e.message || e.toString())
    }
  }, [k1, signer])

  // Restart signer on change
  useEffect(() => {
    if (!signer) return
    signer.startListeningForSpontaneousConnections(challengeHandler, async () => {
      try {
        await auth()
      } catch (e) {
        toaster.danger(e.message || e.toString())
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
    (async () => {
      try {
        if (signer) signer.close()
      } catch (e) {
        toaster.danger(e.message || e.toString())
      }
      try {
        const newSigner = new NostrSigner(
          [22242],
          {
            name: 'Stacker News',
            url: process.env.PUBLIC_URL,
            description: 'Login to Stacker News'
          }
        )
        setNostrConnect(newSigner.getNostrConnectUrl())
        setSigner(newSigner)
      } catch (e) {
        toaster.danger(e.message || e.toString())
      }
    })()
  }, [])

  const showModal = useShowModal()
  return (
    <>

      <Row className='w-100 g-1'>
        <Qr
          asIs
          value={nostrConnect}
          className='mw-100'
          description={`Use a NIP-46 signer to ${text || 'Login'}  with Nostr`}
        />
        <Button
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
                    connect(values.token)
                  }}
                >
                  <Input
                    label='Paste a connection token or nip-05 address'
                    name='token'
                    placeholder='bunker://...  or nip-05 address'
                    required
                    autoFocus
                  />
                  <div className='mt-3'>
                    <div className='d-flex justify-content-between'>
                      <div className='d-flex align-items-center ms-auto'>
                        <CancelButton onClick={onClose} />
                        <SubmitButton variant='primary'>
                          Submit
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
          Use token or nip-05 address
        </Button>
        <div className='mt-2 text-center text-muted fw-bold'>or</div>
        <Button
          variant='nostr'
          className='w-100'
          type='submit'
          onClick={async () => {
            try {
              await auth(signer, true)
            } catch (e) {
              toaster.danger(e.message || e.toString())
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
                      self-hosted on Linux or as cloud service
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

// export function NostrAuth ({ text, callbackUrl }) {
//   const [createAuth, { data, error }] = useMutation(gql`
//     mutation createAuth {
//       createAuth {
//         k1
//       }
//     }`, {
//     // don't cache this mutation
//     fetchPolicy: 'no-cache'
//   })
//   const [hasExtension, setHasExtension] = useState(undefined)
//   const [extensionError, setExtensionError] = useState(null)

//   useEffect(() => {
//     createAuth()
//     setHasExtension(!!window.nostr)
//   }, [])

//   const k1 = data?.createAuth.k1

//   useEffect(() => {
//     if (!k1 || !hasExtension) return

//     console.info('nostr extension detected')

//     let mounted = true;
//     (async function () {
//       try {
//         // have them sign a message with the challenge
//         let event
//         try {
//           event = await callWithTimeout(() => window.nostr.signEvent({
//             kind: 22242,
//             created_at: Math.floor(Date.now() / 1000),
//             tags: [['challenge', k1]],
//             content: 'Stacker News Authentication'
//           }), 5000)
//           if (!event) throw new Error('extension returned empty event')
//         } catch (e) {
//           if (e.message === 'window.nostr call already executing' || !mounted) return
//           setExtensionError({ message: 'nostr extension failed to sign event', details: e.message })
//           return
//         }

//         // sign them in
//         try {
//           await signIn('nostr', {
//             event: JSON.stringify(event),
//             callbackUrl
//           })
//         } catch (e) {
//           throw new Error('authorization failed', e)
//         }
//       } catch (e) {
//         if (!mounted) return
//         console.log('nostr auth error', e)
//         setExtensionError({ message: `${text} failed`, details: e.message })
//       }
//     })()
//     return () => { mounted = false }
//   }, [k1, hasExtension])

//   if (error) return <div>error</div>

//   return (
//     <>
//       {hasExtension === false && <NostrExplainer text={text} />}
//       {extensionError && <ExtensionError {...extensionError} />}
//       {hasExtension && !extensionError &&
//         <>
//           <h4 className='fw-bold text-success pb-1'>nostr extension found</h4>
//           <h6 className='text-muted pb-4'>authorize event signature in extension</h6>
//         </>}
//     </>
//   )
// }

export default function NostrAuthWithExplainer ({ text, callbackUrl }) {
  return (
    <Container className={styles.login}>
      <h3 className='w-100 pb-2'>{text || 'Login'} with Nostr</h3>
      <NostrAuth text={text} callbackUrl={callbackUrl} />
    </Container>
  )
}
