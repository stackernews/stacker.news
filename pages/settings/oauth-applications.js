import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Button, Table, Badge, Modal, Form, Alert, Spinner } from 'react-bootstrap'
import Layout from '../../components/layout'
import { formatDistanceToNow } from 'date-fns'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { SettingsHeader } from './index'
import { useMe } from '../../components/me'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function OAuthApplications () {
  const { me } = useMe()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingApp, setEditingApp] = useState(null)
  const [newApp, setNewApp] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    homepageUrl: '',
    privacyPolicyUrl: '',
    termsOfServiceUrl: '',
    redirectUris: [''],
    scopes: ['read'],
    logoUrl: ''
  })

  const availableScopes = [
    'read',
    'wallet:read',
    'wallet:send',
    'wallet:receive',
    'profile:read'
  ]

  useEffect(() => {
    if (me) {
      fetchApplications()
    }
  }, [me])

  const fetchApplications = async () => {
    try {
      const response = await fetch('/api/oauth/applications')
      if (!response.ok) throw new Error('Failed to fetch applications')
      const data = await response.json()
      setApplications(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      const url = editingApp
        ? `/api/oauth/applications/${editingApp.id}`
        : '/api/oauth/applications'

      const method = editingApp ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          redirectUris: formData.redirectUris.filter(uri => uri.trim())
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save application')
      }

      if (!editingApp) {
        const newApplication = await response.json()
        setNewApp(newApplication)
      }

      await fetchApplications()
      setShowModal(false)
      resetForm()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/oauth/applications/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete application')

      await fetchApplications()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleEdit = (app) => {
    setEditingApp(app)
    setFormData({
      name: app.name,
      description: app.description || '',
      homepageUrl: app.homepageUrl || '',
      privacyPolicyUrl: app.privacyPolicyUrl || '',
      termsOfServiceUrl: app.termsOfServiceUrl || '',
      redirectUris: app.redirectUris,
      scopes: app.scopes,
      logoUrl: app.logoUrl || ''
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setEditingApp(null)
    setFormData({
      name: '',
      description: '',
      homepageUrl: '',
      privacyPolicyUrl: '',
      termsOfServiceUrl: '',
      redirectUris: [''],
      scopes: ['read'],
      logoUrl: ''
    })
  }

  const addRedirectUri = () => {
    setFormData(prev => ({
      ...prev,
      redirectUris: [...prev.redirectUris, '']
    }))
  }

  const updateRedirectUri = (index, value) => {
    setFormData(prev => ({
      ...prev,
      redirectUris: prev.redirectUris.map((uri, i) => i === index ? value : uri)
    }))
  }

  const removeRedirectUri = (index) => {
    setFormData(prev => ({
      ...prev,
      redirectUris: prev.redirectUris.filter((_, i) => i !== index)
    }))
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
                <h2>OAuth Applications</h2>
                <Button variant='primary' onClick={() => setShowModal(true)}>
                  Create Application
                </Button>
              </div>

              {error && <Alert variant='danger'>{error}</Alert>}

              {applications.length === 0
                ? (
                  <Card>
                    <Card.Body className='text-center py-5'>
                      <h5>No OAuth Applications</h5>
                      <p className='text-muted'>
                        Create your first OAuth application to start integrating with Stacker News.
                      </p>
                      <Button variant='primary' onClick={() => setShowModal(true)}>
                        Create Application
                      </Button>
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
                          <th>Status</th>
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
                                {app.scopes.slice(0, 3).map(scope => (
                                  <Badge
                                    key={scope}
                                    variant={getScopeVariant(scope)}
                                    className='me-1 mb-1'
                                  >
                                    {scope}
                                  </Badge>
                                ))}
                                {app.scopes.length > 3 && (
                                  <Badge variant='light'>
                                    +{app.scopes.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td>
                              {app.approved
                                ? (
                                  <Badge variant='success'>Approved</Badge>
                                  )
                                : (
                                  <Badge variant='warning'>Pending</Badge>
                                  )}
                              {app.suspended && (
                                <Badge variant='danger' className='ms-1'>Suspended</Badge>
                              )}
                            </td>
                            <td>
                              <small className='text-muted'>
                                {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                              </small>
                            </td>
                            <td>
                              <Button
                                variant='outline-primary'
                                size='sm'
                                className='me-2'
                                onClick={() => handleEdit(app)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant='outline-danger'
                                size='sm'
                                onClick={() => handleDelete(app.id)}
                              >
                                Delete
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

          <Modal show={showModal} onHide={() => setShowModal(false)} size='lg'>
            <Modal.Header closeButton>
              <Modal.Title>
                {editingApp ? 'Edit Application' : 'Create Application'}
              </Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
              <Modal.Body>
                {error && <Alert variant='danger'>{error}</Alert>}

                <Row>
                  <Col md={6}>
                    <Form.Group className='mb-3'>
                      <Form.Label>Application Name *</Form.Label>
                      <Form.Control
                        type='text'
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className='mb-3'>
                      <Form.Label>Logo URL</Form.Label>
                      <Form.Control
                        type='url'
                        value={formData.logoUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, logoUrl: e.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className='mb-3'>
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as='textarea'
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </Form.Group>

                <Row>
                  <Col md={4}>
                    <Form.Group className='mb-3'>
                      <Form.Label>Homepage URL</Form.Label>
                      <Form.Control
                        type='url'
                        value={formData.homepageUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, homepageUrl: e.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className='mb-3'>
                      <Form.Label>Privacy Policy URL</Form.Label>
                      <Form.Control
                        type='url'
                        value={formData.privacyPolicyUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, privacyPolicyUrl: e.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className='mb-3'>
                      <Form.Label>Terms of Service URL</Form.Label>
                      <Form.Control
                        type='url'
                        value={formData.termsOfServiceUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, termsOfServiceUrl: e.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className='mb-3'>
                  <Form.Label>Redirect URIs *</Form.Label>
                  {formData.redirectUris.map((uri, index) => (
                    <div key={index} className='d-flex mb-2'>
                      <Form.Control
                        type='url'
                        value={uri}
                        onChange={(e) => updateRedirectUri(index, e.target.value)}
                        placeholder='https://your-app.com/oauth/callback'
                        required={index === 0}
                      />
                      {formData.redirectUris.length > 1 && (
                        <Button
                          variant='outline-danger'
                          className='ms-2'
                          onClick={() => removeRedirectUri(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant='outline-secondary' size='sm' onClick={addRedirectUri}>
                    Add Redirect URI
                  </Button>
                </Form.Group>

                <Form.Group className='mb-3'>
                  <Form.Label>Scopes *</Form.Label>
                  {availableScopes.map(scope => (
                    <Form.Check
                      key={scope}
                      type='checkbox'
                      label={scope}
                      checked={formData.scopes.includes(scope)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            scopes: [...prev.scopes, scope]
                          }))
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            scopes: prev.scopes.filter(s => s !== scope)
                          }))
                        }
                      }}
                    />
                  ))}
                </Form.Group>
              </Modal.Body>
              <Modal.Footer>
                <Button variant='secondary' onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button variant='primary' type='submit'>
                  {editingApp ? 'Update Application' : 'Create Application'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal>

          <Modal show={!!newApp} onHide={() => setNewApp(null)}>
            <Modal.Header closeButton>
              <Modal.Title>Application Created</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Alert variant='warning'>
                Your client secret is shown below. Make sure to copy it now. You won't be able to see it again.
              </Alert>
              <Form.Group>
                <Form.Label>Client ID</Form.Label>
                <Form.Control type='text' value={newApp?.clientId} readOnly />
              </Form.Group>
              <Form.Group className='mt-3'>
                <Form.Label>Client Secret</Form.Label>
                <Form.Control type='text' value={newApp?.clientSecret} readOnly />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant='primary' onClick={() => setNewApp(null)}>
                Done
              </Button>
            </Modal.Footer>
          </Modal>
        </Container>
      </div>
    </Layout>
  )
}
