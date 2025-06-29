import { useState, useEffect } from 'react'
import { Container, Card, Button, Table, Badge, Alert, Spinner } from 'react-bootstrap'
import Layout from '../../components/layout'
import { formatDistanceToNow } from 'date-fns'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { useMe } from '../../components/me'
import { useMutation, gql } from '@apollo/client'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function AdminOAuthApplications () {
  const { me } = useMe()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [approveApplication] = useMutation(gql`
    mutation approveOAuthApplication($id: ID!) {
      approveOAuthApplication(id: $id) {
        id
        approved
      }
    }
  `)

  useEffect(() => {
    if (me) {
      fetchApplications()
    }
  }, [me])

  const fetchApplications = async () => {
    try {
      const response = await fetch('/api/admin/oauth-applications')
      if (!response.ok) throw new Error('Failed to fetch applications')
      const data = await response.json()
      setApplications(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id) => {
    if (!window.confirm('Are you sure you want to approve this application?')) {
      return
    }

    try {
      await approveApplication({ variables: { id } })
      await fetchApplications()
    } catch (err) {
      setError(err.message)
    }
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

  if (!me || !me.isAdmin) {
    return (
      <Layout>
        <Container>
          <Alert variant='danger' className='text-center'>
            You are not authorized to view this page.
          </Alert>
        </Container>
      </Layout>
    )
  }

  return (
    <Layout>
      <Container>
        <h2 className='mb-4'>Pending OAuth Applications</h2>

        {error && <Alert variant='danger'>{error}</Alert>}

        {applications.length === 0
          ? (
            <Card>
              <Card.Body className='text-center py-5'>
                <h5>No Pending OAuth Applications</h5>
                <p className='text-muted'>
                  All OAuth applications have been approved or there are no new applications.
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
                    <th>Client ID</th>
                    <th>Scopes</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map(app => (
                    <tr key={app.id}>
                      <td>
                        <div className='d-flex align-items-center'>
                          {app.logoUrl
                            ? (
                              <img
                                src={app.logoUrl}
                                alt={app.name}
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
                            <div className='fw-bold'>{app.name}</div>
                            {app.description && (
                              <small className='text-muted'>{app.description}</small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <code className='small'>{app.clientId}</code>
                      </td>
                      <td>
                        <div>
                          {app.scopes.map(scope => (
                            <Badge key={scope} variant='secondary' className='me-1 mb-1'>
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td>
                        <small className='text-muted'>
                          {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                        </small>
                      </td>
                      <td>
                        <Button
                          variant='success'
                          size='sm'
                          onClick={() => handleApprove(app.id)}
                        >
                          Approve
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
            )}
      </Container>
    </Layout>
  )
}
