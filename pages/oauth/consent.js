import { useState } from 'react'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { Container, Row, Col, Card, Button, Alert } from 'react-bootstrap'
import { useSession } from 'next-auth/react'
import Layout from '../../components/layout'

const SCOPE_DESCRIPTIONS = {
  read: 'Read your public profile, posts, and comments',
  'wallet:read': 'View your wallet balance and transaction history',
  'wallet:send': 'Send payments from your wallet',
  'wallet:receive': 'Create invoices and receive payments to your wallet',
  'profile:read': 'Access your profile information and settings'
}

const SCOPE_ICONS = {
  read: '👁️',
  'wallet:read': '👀',
  'wallet:send': '⚡',
  'wallet:receive': '📥',
  'profile:read': '👤'
}

export default function OAuthConsent ({ application = {}, scopes = [], params }) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleApprove = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...params,
          scope: scopes.join(' '),
          approved: true
        })
      })

      if (response.redirected) {
        window.location.href = response.url
        return
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Authorization failed')
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleDeny = () => {
    const redirectUrl = new URL(params.redirect_uri)
    redirectUrl.searchParams.set('error', 'access_denied')
    redirectUrl.searchParams.set('error_description', 'User denied authorization')
    if (params.state) redirectUrl.searchParams.set('state', params.state)

    window.location.href = redirectUrl.toString()
  }

  console.log('Scopes received:', scopes)
  const walletScopes = scopes.filter(scope => scope.startsWith('wallet:'))
  const otherScopes = scopes.filter(scope => !scope.startsWith('wallet:'))

  return (
    <Layout>
      <Container>
        <Row className='justify-content-center'>
          <Col lg={6} md={8}>
            <Card className='shadow'>
              <Card.Header className='bg-primary text-white text-center'>
                <h4>Authorize Application</h4>
              </Card.Header>
              <Card.Body className='p-4'>
                {error && (
                  <Alert variant='danger' className='mb-3'>
                    {error}
                  </Alert>
                )}

                <div className='text-center mb-4'>
                  {application?.logoUrl
                    ? (
                      <img
                        src={application.logoUrl}
                        alt={`${application.name} logo`}
                        className='mb-3'
                        style={{ maxHeight: '80px', maxWidth: '80px' }}
                      />
                      )
                    : (
                      <div
                        className='bg-light rounded-circle d-inline-flex align-items-center justify-content-center mb-3'
                        style={{ width: '80px', height: '80px', fontSize: '2rem' }}
                      >
                        🔗
                      </div>
                      )}
                  <h5 className='mb-2'>{application?.name}</h5>
                  {application?.description && (
                    <p className='text-muted small'>{application.description}</p>
                  )}
                </div>

                <div className='mb-4'>
                  <p className='text-center'>
                    <strong>{application.name}</strong> would like to:
                  </p>

                  {otherScopes.length > 0 && (
                    <div className='mb-3'>
                      <h6 className='text-muted'>General Permissions</h6>
                      <ul className='list-unstyled'>
                        {otherScopes.map(scope => (
                          <li key={scope} className='mb-2'>
                            <span className='me-2'>{SCOPE_ICONS[scope]}</span>
                            {SCOPE_DESCRIPTIONS[scope]}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {walletScopes.length > 0 && (
                    <div className='mb-3'>
                      <h6 className='text-warning'>⚠️ Wallet Permissions</h6>
                      <Alert variant='warning' className='small mb-2'>
                        <strong>Important:</strong> This application is requesting access to your wallet.
                        Only approve if you trust this application.
                      </Alert>
                      <ul className='list-unstyled'>
                        {walletScopes.map(scope => (
                          <li key={scope} className='mb-2'>
                            <span className='me-2'>{SCOPE_ICONS[scope]}</span>
                            <strong>{SCOPE_DESCRIPTIONS[scope]}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className='mb-3'>
                  <small className='text-muted'>
                    By authorizing this application, you allow it to access your Stacker News account
                    according to the permissions listed above. You can revoke this access at any time
                    from your account settings.
                  </small>
                </div>

                {application.privacyPolicyUrl && (
                  <div className='mb-3 text-center'>
                    <a href={application.privacyPolicyUrl} target='_blank' rel='noopener noreferrer' className='small'>
                      Privacy Policy
                    </a>
                    {application.termsOfServiceUrl && (
                      <>
                        <span className='mx-2'>•</span>
                        <a href={application.termsOfServiceUrl} target='_blank' rel='noopener noreferrer' className='small'>
                          Terms of Service
                        </a>
                      </>
                    )}
                  </div>
                )}

                <div className='d-grid gap-2'>
                  <Button
                    variant='success'
                    size='lg'
                    onClick={handleApprove}
                    disabled={loading}
                  >
                    {loading ? 'Authorizing...' : 'Authorize Application'}
                  </Button>
                  <Button
                    variant='outline-secondary'
                    onClick={handleDeny}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>

                <div className='text-center mt-3'>
                  <small className='text-muted'>
                    Signed in as <strong>@{session?.user?.name}</strong>
                  </small>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </Layout>
  )
}

export const getServerSideProps = getGetServerSideProps({
  authRequired: true
}, async (context) => {
  const { query } = context

  const clientId = query.client_id
  const redirectUri = query.redirect_uri
  const scope = query.scope
  const state = query.state
  const codeChallenge = query.code_challenge
  const codeChallengeMethod = query.code_challenge_method

  if (!clientId || !redirectUri || !scope) {
    return {
      notFound: true
    }
  }

  try {
    // Import models in getServerSideProps
    const models = (await import('../../api/models')).default

    // Find the application
    const application = await models.oAuthApplication.findFirst({
      where: {
        clientId,
        approved: true,
        suspended: false
      },
      select: {
        id: true,
        name: true,
        description: true,
        logoUrl: true,
        privacyPolicyUrl: true,
        termsOfServiceUrl: true,
        scopes: true
      }
    })

    if (!application) {
      return {
        notFound: true
      }
    }

    const requestedScopes = scope.split(' ')
    console.log('getServerSideProps - query.scope:', scope)
    console.log('getServerSideProps - requestedScopes:', requestedScopes)
    const validScopes = application.scopes.map(s => s.replace('_', ':'))

    // Validate scopes
    for (const requestedScope of requestedScopes) {
      if (!validScopes.includes(requestedScope)) {
        return {
          notFound: true
        }
      }
    }

    return {
      props: {
        application: {
          ...application,
          scopes: application.scopes.map(s => s.replace('_', ':'))
        },
        scopes: requestedScopes,
        params: {
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state: state || '',
          code_challenge: codeChallenge || '',
          code_challenge_method: codeChallengeMethod || ''
        }
      }
    }
  } catch (error) {
    console.error('Error in OAuth consent getServerSideProps:', error)
    return {
      notFound: true
    }
  }
})
