import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Table, Badge, Alert, Spinner } from 'react-bootstrap'
import Layout from '../../components/layout'
import { formatDistanceToNow } from 'date-fns'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { SettingsHeader } from './index'
import { useMe } from '../../components/me'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function AuthorizedOAuthApplications () {
  const { me } = useMe()
  const [grants, setGrants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (me) {
      fetchGrants()
    }
  }, [me])

  const fetchGrants = async () => {
    try {
      const response = await fetch('/api/oauth/authorized-applications')
      if (!response.ok) throw new Error('Failed to fetch authorized applications')
      const data = await response.json()
      setGrants(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (id) => {
    if (!window.confirm('Are you sure you want to revoke access for this application?')) {
      return
    }

    try {
      const response = await fetch(`/api/oauth/authorized-applications/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to revoke access')

      await fetchGrants()
    } catch (err) {
      setError(err.message)
    }
  }

  const getScopeVariant = (scope) => {
    if (scope.startsWith('wallet:')) return 'warning'
    if (scope.startsWith('write:')) return 'info'
    return 'secondary'
  }

  if (loading) {
    return (
      <Layout>
        <Container>
          <div className='text-center py-5'>
            <Spinner animation='border' />
          </div>
        </Container>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className='pb-3 w-100 mt-2' style={{ maxWidth: '600px' }}>
        <SettingsHeader />
        <Container>
          <Row>
            <Col>
              <div className='d-flex justify-content-between align-items-center mb-4'>
                <h2>Authorized Applications</h2>
              </div>

              {error && <Alert variant='danger'>{error}</Alert>}

              {grants.length === 0
                ? (
                  <Card>
                    <Card.Body className='text-center py-5'>
                      <h5>No Authorized Applications</h5>
                      <p className='text-muted'>
                        You have not authorized any applications to access your Stacker News account.
                      </p>
                    </Card.Body>
                  </Card>
                  )
                : (
                  <Card>
                    <Table responsive hover>
                      <thead>
                        <tr>
                          <th>Application</th>
                          <th>Scopes</th>
                          <th>Authorized</th>
                          <th>Expires</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grants.map(grant => (
                          <tr key={grant.id}>
                            <td>
                              <div className='d-flex align-items-center'>
                                {grant.application.logoUrl
                                  ? (
                                    <img
                                      src={grant.application.logoUrl}
                                      alt={grant.application.name}
                                      className='me-2'
                                      style={{ width: '32px', height: '32px', borderRadius: '4px' }}
                                    />
                                    )
                                  : (
                                    <div
                                      className='bg-light rounded me-2 d-flex align-items-center justify-content-center'
                                      style={{ width: '32px', height: '32px' }}
                                    >
                                      🔗
                                    </div>
                                    )}
                                <div>
                                  <div className='fw-bold'>{grant.application.name}</div>
                                  {grant.application.description && (
                                    <small className='text-muted'>{grant.application.description}</small>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div>
                                {grant.scopes.map(scope => (
                                  <Badge
                                    key={scope}
                                    variant={getScopeVariant(scope)}
                                    className='me-1 mb-1'
                                  >
                                    {scope}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td>
                              <small className='text-muted'>
                                {formatDistanceToNow(new Date(grant.createdAt), { addSuffix: true })}
                              </small>
                            </td>
                            <td>
                              <small className='text-muted'>
                                {grant.expiresAt ? formatDistanceToNow(new Date(grant.expiresAt), { addSuffix: true }) : 'Never'}
                              </small>
                            </td>
                            <td>
                              <Button
                                variant='outline-danger'
                                size='sm'
                                onClick={() => handleRevoke(grant.id)}
                              >
                                Revoke
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card>
                  )}
            </Col>
          </Row>
        </Container>
      </div>
    </Layout>
  )
}
