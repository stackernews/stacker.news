import { useEffect, useState } from 'react'
import { gql, useMutation } from '@apollo/client'
import { signIn } from 'next-auth/react'
import Container from 'react-bootstrap/Container'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import { useRouter } from 'next/router'
import AccordianItem from './accordian-item'
import BackIcon from '../svgs/arrow-left-line.svg'
import styles from './lightning-auth.module.css'

function ExtensionError ({ message, details }) {
  return (
    <>
      <div className='fw-bold text-muted pb-1'>error: {message}</div>
      <div className='text-muted pb-4'>{details}</div>
    </>
  )
}

function NostrExplainer ({ text }) {
  return (
    <>
      <div className='fw-bold text-muted pb-1'>error: nostr extension not found</div>
      <div className='text-muted pb-4'>Nostr extensions are the safest way to use your nostr identity on Stacker News.</div>
      <Row className='w-100 text-muted'>
        <AccordianItem
          header={`Which extensions can I use to ${(text || 'Login').toLowerCase()}?`}
          body={
            <>
              <Row className='mb-3 no-gutters'>
                You can use any extension that supports signing. These are some extensions you can use:
              </Row>
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

export function NostrAuth ({ text, callbackUrl }) {
  const [createAuth, { data, error }] = useMutation(gql`
    mutation createAuth {
      createAuth {
        k1
      }
    }`)
  const [hasExtension, setHasExtension] = useState(undefined)
  const [extensionError, setExtensionError] = useState(null)

  useEffect(() => {
    createAuth()
  }, [])

  const k1 = data?.createAuth.k1

  useEffect(() => {
    if (!k1) return
    setHasExtension(!!window.nostr)
    if (!window.nostr) {
      const err = { message: 'nostr extension not found' }
      console.error(err.message)
      return
    }
    console.info('nostr extension detected')
    let mounted = true;
    (async function () {
      try {
        // have them sign a message with the challenge
        let event
        try {
          event = await window.nostr.signEvent({
            kind: 22242,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['challenge', k1]],
            content: 'Stacker News Authentication'
          })
          if (!event) throw new Error('extension returned empty event')
        } catch (e) {
          if (e.message === 'window.nostr call already executing') return
          setExtensionError({ message: 'nostr extension failed to sign event', details: e.message })
          return
        }

        // sign them in
        try {
          const { error, ok } = await signIn('nostr', {
            event: JSON.stringify(event),
            callbackUrl
          })

          if (error) {
            throw new Error(error)
          }
          if (!ok) {
            throw new Error('auth failed')
          }
        } catch (e) {
          throw new Error('authorization failed', e)
        }
      } catch (e) {
        if (!mounted) return
        setExtensionError({ message: `${text} failed`, details: e.message })
      }
    })()
    return () => { mounted = false }
  }, [k1, hasExtension])

  if (error) return <div>error</div>

  return (
    <>
      {hasExtension === false ? <NostrExplainer text={text} /> : null}
      {extensionError ? <ExtensionError {...extensionError} /> : null}
      {hasExtension && !extensionError
        ? (
          <>
            <div className='fw-bold text-muted pb-1'>nostr extension found</div>
            <div className='text-muted pb-4'>authorize event signature in extension</div>
          </>
          )
        : null}
    </>
  )
}

export default function NostrAuthWithExplainer ({ text, callbackUrl }) {
  const router = useRouter()
  return (
    <Container>
      <div className={styles.login}>
        <div className='w-100 mb-3 text-muted pointer' onClick={() => router.back()}><BackIcon /></div>
        <h3 className='w-100 pb-2'>{text || 'Login'} with Nostr</h3>
        <NostrAuth text={text} callbackUrl={callbackUrl} />
      </div>
    </Container>
  )
}
