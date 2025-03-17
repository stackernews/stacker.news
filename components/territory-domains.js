import { Badge } from 'react-bootstrap'
import { Form, Input, SubmitButton } from './form'
import { gql, useMutation } from '@apollo/client'
import { customDomainSchema } from '@/lib/validate'
import ActionTooltip from './action-tooltip'
import { useToast } from '@/components/toast'

const SET_CUSTOM_DOMAIN = gql`
  mutation SetCustomDomain($subName: String!, $domain: String!) {
    setCustomDomain(subName: $subName, domain: $domain) {
      domain
      dnsState
      sslState
    }
  }
`

// TODO: verification states should refresh
export default function CustomDomainForm ({ sub }) {
  const [setCustomDomain] = useMutation(SET_CUSTOM_DOMAIN, {
    refetchQueries: ['Sub']
  })
  const toaster = useToast()

  const onSubmit = async ({ domain }) => {
    await setCustomDomain({
      variables: {
        subName: sub.name,
        domain
      }
    })
    toaster.success('domain updated successfully')
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge bg='success'>DNS verified</Badge>
      case 'PENDING':
        return <Badge bg='warning'>DNS pending</Badge>
      case 'FAILED':
        return <Badge bg='danger'>DNS failed</Badge>
    }
  }

  const getSSLStatusBadge = (sslState) => {
    switch (sslState) {
      case 'VERIFIED':
        return <Badge bg='success'>SSL verified</Badge>
      case 'PENDING':
        return <Badge bg='warning'>SSL pending</Badge>
      case 'FAILED':
        return <Badge bg='danger'>SSL failed</Badge>
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
              <span>custom domain</span>
              {sub?.customDomain && (
                <>
                  <div className='d-flex align-items-center gap-2'>
                    <ActionTooltip overlayText={new Date(sub.customDomain.lastVerifiedAt).toUTCString()}>
                      {getStatusBadge(sub.customDomain.dnsState)}
                    </ActionTooltip>
                    {getSSLStatusBadge(sub.customDomain.sslState)}
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
      {(sub.customDomain.dnsState === 'PENDING' || sub.customDomain.dnsState === 'FAILED') && (
        <>
          <h6>Verify your domain</h6>
          <p>Add the following DNS records to verify ownership of your domain:</p>
          <pre>
            CNAME:
            Host: @
            Value: stacker.news
          </pre>
          <pre>
            TXT:
            Host: @
            Value: ${sub.customDomain.verificationTxt}
          </pre>
        </>
      )}
      {sub.customDomain.sslState === 'PENDING' && (
        <>
          <h6>SSL verification pending</h6>
          <p>We issued an SSL certificate for your domain.</p>
          <pre>
            CNAME:
            Host: ${sub.customDomain.verificationCname}
            Value: ${sub.customDomain.verificationCnameValue}
          </pre>
          <pre>
            TXT:
            Host: @
            Value: ${sub.customDomain.verificationTxt}
          </pre>
        </>
      )}
    </Form>
  )
}
