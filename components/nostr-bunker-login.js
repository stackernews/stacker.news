import { useState, useCallback, useEffect } from 'react'
import { gql, useMutation } from '@apollo/client'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useToast } from '@/components/toast'
import { Button, Container, Row, Col, Card } from 'react-bootstrap'
import { Form, Input, SubmitButton, CopyInput } from '@/components/form'
import { QRCodeSVG } from 'qrcode.react'
import Moon from '@/svgs/moon-fill.svg'
import QrCodeIcon from '@/svgs/qr-code-line.svg'
import BackIcon from '@/svgs/arrow-left-line.svg'
import NostrConnectSession from '@/lib/nostr-connect'
import styles from './nostr-bunker-login.module.css'

const BUNKER_PROVIDERS = [
  {
    name: 'Amber',
    url: 'https://github.com/greenart7c3/Amber',
    description: 'Android Nostr signer'
  },
  {
    name: 'nsec.app',
    url: 'https://nsec.app',
    description: 'Web-based Nostr key manager'
  },
  {
    name: 'nsecBunker',
    url: 'https://nsecbunker.com',
    description: 'Self-hosted or cloud bunker'
  },
  {
    url: 'https://nsecbunker.com',
    description: 'Self-hosted or cloud bunker',
    deepLink: null,
    downloadUrl: 'https://nsecbunker.com'
  }
]

export function NostrBunkerLogin ({ text = 'Login', callbackUrl, multiAuth, compact = false }) {
  const [step, setStep] = useState('choose')
  const [connectURI, setConnectURI] = useState(null)
  const [connectStatus, setConnectStatus] = useState([])
  const [currentSession, setCurrentSession] = useState(null)

  const router = useRouter()
  const toaster = useToast()

  const [createAuth] = useMutation(gql`
    mutation createAuth {
      createAuth {
        k1
      }
    }`, {
    fetchPolicy: 'no-cache'
  })

  const handleError = useCallback((error) => {
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred'

    // User-friendly error messages
    const friendlyMessages = {
      'Challenge tags required': 'Authentication setup failed. Please try again.',
      'Decryption failed': 'Unable to communicate with signer. Please check your app.',
      'Event verification failed': 'Signature verification failed. Please try again.',
      'Failed to decrypt message': 'Communication error with signer app.',
      'Send failed': 'Network error. Please check your connection.',
      'Session expired': 'Login session expired. Please generate a new QR code.'
    }

    const matchingKey = Object.keys(friendlyMessages).find(key =>
      errorMessage.includes(key)
    )
    const userMessage = matchingKey
      ? friendlyMessages[matchingKey]
      : errorMessage

    toaster.danger(userMessage)
    setStep('choose')
  }, [toaster])

  const startQRLogin = async () => {
    try {
      setStep('qr')
      setConnectStatus([{ message: 'Preparing QR code...', error: false }])

      const { data, error } = await createAuth()
      if (error) throw error
      const k1 = data?.createAuth.k1
      if (!k1) throw new Error('Error generating challenge')

      const session = new NostrConnectSession({
        metadata: {
          name: 'Stacker News',
          url: process.env.NEXT_PUBLIC_URL,
          description: 'Bitcoin-focused social network'
        }
      })

      setCurrentSession(session)
      setConnectURI(session.uri)
      setConnectStatus([{ message: 'QR code ready - scan with your Nostr signer', error: false }])

      await session.startWithChallenge([
        ['challenge', k1],
        ['u', process.env.NEXT_PUBLIC_URL],
        ['method', 'GET']
      ], {
        onSigned: async (signedEvent) => {
          try {
            setConnectStatus(prev => [...prev, { message: 'Signing in...', error: false }].slice(-10))
            await signIn('nostr', {
              event: JSON.stringify(signedEvent),
              callbackUrl,
              multiAuth
            })
          } finally {
            session.close()
          }
        },
        timeoutMs: 300000,
        onStatus: (status, extra) => {
          const messages = {
            listening: 'Waiting for signer...',
            connected: 'Signer connected!',
            'connect-request': 'Processing connection...',
            'requesting-pubkey': 'Getting public key...',
            'got-pubkey': 'Requesting signature...',
            'requesting-signature': 'Waiting for signature...',
            signed: 'Success! Signing in...',
            timeout: 'Connection timeout - please try again',
            error: `Error: ${extra || status}`,
            closed: 'Connection closed'
          }
          const displayMsg = messages[status] || status
          setConnectStatus(prev => [...prev, displayMsg].slice(-10))
        }
      })
    } catch (error) {
      handleError(error)
    }
  }

  const cleanup = () => {
    if (currentSession) {
      currentSession.close()
      setCurrentSession(null)
    }
    setConnectURI(null)
    setConnectStatus([])
  }

  useEffect(() => {
    return cleanup
  }, [])

  if (step === 'qr') {
    if (compact) {
      return (
        <div className='text-center'>
          <div className='d-flex justify-content-between align-items-center mb-3'>
            <h6 className='mb-0'>Scan QR Code</h6>
            <Button
              variant='outline-secondary'
              size='sm'
              onClick={() => { cleanup(); setStep('choose') }}
            >
              Back
            </Button>
          </div>

          {connectURI
            ? (
              <div className='d-flex flex-column align-items-center'>
                <div className='d-block p-2 mx-auto mb-2' style={{ background: 'white', maxWidth: '200px' }}>
                  <QRCodeSVG className='h-auto mw-100' value={connectURI} size={200} />
                </div>

                <div className='w-100 mb-2'>
                  <div className='input-group input-group-sm'>
                    <input
                      type='text'
                      className='form-control'
                      placeholder='nostr+walletconnect://...'
                      value={connectURI}
                      readOnly
                      style={{ fontSize: '0.8rem' }}
                    />
                    <button
                      className='btn btn-outline-secondary'
                      type='button'
                      onClick={() => navigator.clipboard.writeText(connectURI)}
                      title='Copy to clipboard'
                    >
                      📋
                    </button>
                  </div>
                  <small className='text-muted'>Connection URI</small>
                </div>

                <div className='text-muted small mb-2'>
                  {connectStatus.length > 0 && (
                    <div>
                      {connectStatus.map((status, i) => (
                        <div key={`status-compact-${i}-${Date.now()}`} className={status.error ? 'text-danger' : 'text-success'}>
                          {status.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className='text-muted small'>
                  <p className='mb-1'><strong>Compatible apps:</strong></p>
                  <div className='d-flex justify-content-center gap-2 flex-wrap'>
                    {BUNKER_PROVIDERS.map((provider, index) => (
                      <span key={`${provider.name}-compact-${index}`} className='badge bg-light text-dark'>
                        {provider.icon} {provider.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              )
            : (
              <div className='text-center'>
                <p className='text-muted'>Generating QR code...</p>
              </div>
              )}
        </div>
      )
    }

    return (
      <Container>
        <div className={styles.login}>
          <div
            className='w-100 mb-3 text-muted pointer d-flex align-items-center gap-2'
            onClick={() => { cleanup(); setStep('choose') }}
          >
            <BackIcon /> Back to options
          </div>

          <h3 className='w-100 pb-2 text-center'>Scan QR Code</h3>

          <div className='text-center mb-4'>
            <p className='text-muted'>Scan this QR code with your Nostr signer app</p>
          </div>

          {connectURI
            ? (
              <div className='d-flex flex-column align-items-center'>
                <div className='d-block p-3 mx-auto mb-3' style={{ background: 'white', maxWidth: '280px' }}>
                  <QRCodeSVG className='h-auto mw-100' value={connectURI} size={280} />
                </div>

                <div className='w-100 mb-3'>
                  <CopyInput
                    type='text'
                    placeholder={connectURI}
                    readOnly
                    noForm
                    className='text-center small'
                  />
                </div>

                {connectStatus.length > 0 && (
                  <Card className='w-100 mb-3'>
                    <Card.Body className='py-2'>
                      <div className='text-muted small'>
                        {connectStatus.map((status, i) => (
                          <div key={`status-full-${i}-${status.message.slice(0, 10)}`} className='d-flex align-items-center gap-2 py-1'>
                            {status.message.includes('...') && <Moon className='spin fill-grey' width='14' height='14' />}
                            <span>{status.message}</span>
                          </div>
                        ))}
                      </div>
                    </Card.Body>
                  </Card>
                )}

                <div className='text-center text-muted small'>
                  <p>Compatible with:</p>
                  <div className='d-flex justify-content-center gap-3 flex-wrap'>
                    {BUNKER_PROVIDERS.map((provider, index) => (
                      <span key={`${provider.name}-full-${index}`} className='d-flex align-items-center gap-1'>
                        <span>{provider.icon}</span>
                        <span>{provider.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              )
            : (
              <div className='text-center py-4'>
                <Moon className='spin fill-grey' width='30' height='30' />
                <p className='text-muted mt-2'>Generating QR code...</p>
              </div>
              )}
        </div>
      </Container>
    )
  }

  if (compact) {
    return (
      <div className='text-center'>
        <h6 className='mb-3'>QR Code Login</h6>
        <p className='text-muted small mb-3'>
          Scan a QR code with your mobile Nostr signer app
        </p>
        <Button
          variant='primary'
          className='w-100'
          onClick={startQRLogin}
        >
          Generate QR Code
        </Button>
        <div className='mt-2 text-muted small'>
          <p className='mb-1'><strong>Compatible apps:</strong></p>
          <div className='d-flex justify-content-center gap-2 flex-wrap'>
            {BUNKER_PROVIDERS.map((provider, index) => (
              <span key={`${provider.name}-${index}`} className='badge bg-light text-dark'>
                {provider.icon} {provider.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Container>
      <div className={styles.login}>
        <div
          className='w-100 mb-3 text-muted pointer d-flex align-items-center gap-2'
          onClick={() => router.back()}
        >
          <BackIcon /> Back
        </div>

        <h3 className='w-100 pb-2 text-center'>{text} with Nostr</h3>

        <div className='text-center mb-4'>
          <p className='text-muted'>Choose your preferred login method</p>
        </div>

        <Row className='w-100 g-3'>
          <Col md={6}>
            <Card className='h-100 cursor-pointer border-2' onClick={startQRLogin}>
              <Card.Body className='d-flex flex-column align-items-center text-center p-4'>
                <QrCodeIcon width='48' height='48' className='text-primary mb-3' />
                <h5 className='mb-2'>Scan QR Code</h5>
                <p className='text-muted small mb-3'>
                  Use your mobile Nostr signer app to scan a QR code
                </p>
                <Button variant='primary' className='w-100'>
                  Generate QR Code
                </Button>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className='h-100'>
              <Card.Body className='d-flex flex-column align-items-center text-center p-4'>
                <div className='mb-3' style={{ fontSize: '3rem' }}>🔐</div>
                <h5 className='mb-2'>Bunker URL</h5>
                <p className='text-muted small mb-3'>
                  Connect using a bunker:// URL or NIP-05 address
                </p>

                <Form
                  className='w-100'
                  initial={{ bunker: '' }}
                  onSubmit={async (values) => {
                    if (!values.bunker.trim()) {
                      toaster.danger('Please enter a bunker URL or NIP-05 address')
                      return
                    }
                    toaster.info('Bunker URL login coming soon! Use QR code for now.')
                  }}
                >
                  <Input
                    name='bunker'
                    placeholder='bunker://... or user@domain.com'
                    className='mb-2'
                    size='sm'
                  />
                  <SubmitButton variant='secondary' size='sm' className='w-100'>
                    Connect
                  </SubmitButton>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <hr className='my-4' />

        <div className='text-center'>
          <h6 className='text-muted mb-3'>Compatible Signers</h6>
          <Row className='g-3'>
            {BUNKER_PROVIDERS.map((provider, index) => (
              <Col key={`${provider.name}-detail-${index}`} md={4}>
                <Card className='text-center border-0 bg-light'>
                  <Card.Body className='py-3'>
                    <div className='mb-2' style={{ fontSize: '1.5rem' }}>{provider.icon}</div>
                    <h6 className='mb-1'>{provider.name}</h6>
                    <p className='text-muted small mb-2'>{provider.description}</p>
                    <a
                      href={provider.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center gap-1'
                    >
                      Visit
                    </a>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </div>
    </Container>
  )
}

export default NostrBunkerLogin
