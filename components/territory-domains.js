import { useState } from 'react'
import { Badge } from 'react-bootstrap'
import { Form, Input, SubmitButton } from './form'
import { gql, useMutation } from '@apollo/client'
import Info from './info'
import { customDomainSchema } from '@/lib/validate'
import ActionTooltip from './action-tooltip'

const UPDATE_CUSTOM_DOMAIN = gql`
  mutation UpdateCustomDomain($subName: String!, $domain: String!) {
    updateCustomDomain(subName: $subName, domain: $domain) {
      domain
      verificationState
    }
  }
`

// TODO: verification states should refresh
export default function CustomDomainForm ({ sub }) {
  const [updateCustomDomain] = useMutation(UPDATE_CUSTOM_DOMAIN)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const onSubmit = async ({ domain }) => {
    setError(null)
    setSuccess(false)
    console.log('domain', domain)

    const { data } = await updateCustomDomain({
      variables: {
        subName: sub.name,
        domain
      }
    })
    console.log('success', data)
    setSuccess(true)
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge bg='success'>verified</Badge>
      case 'PENDING':
        return <Badge bg='warning'>pending</Badge>
      case 'FAILED':
        return <Badge bg='danger'>failed</Badge>
    }
  }

  const getSSLStatusBadge = (sslEnabled) => {
    switch (sslEnabled) {
      case true:
        return <Badge bg='success'>SSL enabled</Badge>
      case false:
        return <Badge bg='danger'>SSL disabled</Badge>
    }
  }

  return (
    <Form
      initial={{
        domain: sub?.customDomain?.domain || ''
      }}
      schema={customDomainSchema}
      onSubmit={onSubmit}
      className='mb-2'
    >
      {/* todo: too many flexes */}
      <div className='d-flex align-items-center gap-2'>
        <Input
          label={
            <div className='d-flex align-items-center gap-2'>
              <span>domain</span>
              {error && <Info variant='danger'>error</Info>}
              {success && <Info variant='success'>Domain settings updated successfully!</Info>}
              {sub?.customDomain && (
                <>
                  <div className='d-flex align-items-center gap-2'>
                    <ActionTooltip overlayText={new Date(sub.customDomain.lastVerifiedAt).toUTCString()}>
                      {getStatusBadge(sub.customDomain.verificationState)}
                    </ActionTooltip>
                    {getSSLStatusBadge(sub.customDomain.sslEnabled)}
                    {sub.customDomain.verificationState === 'PENDING' && (
                      <Info>
                        <h6>Verify your domain</h6>
                        <p>Add the following DNS records to verify ownership of your domain:</p>
                        <pre>
                          CNAME record:
                          Host: @
                          Value: stacker.news
                        </pre>
                      </Info>
                    )}
                  </div>
                </>
              )}
            </div>
          }
          name='domain'
          placeholder='example.com'
        />
        {/* TODO: toaster */}
        <SubmitButton variant='primary' className='mt-3'>save</SubmitButton>
      </div>
    </Form>
  )
}
