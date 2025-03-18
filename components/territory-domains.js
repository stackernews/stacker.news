import { Badge } from 'react-bootstrap'
import { Form, Input, SubmitButton } from './form'
import { gql, useMutation, useQuery } from '@apollo/client'
import { customDomainSchema } from '@/lib/validate'
import ActionTooltip from './action-tooltip'
import { useToast } from '@/components/toast'
import { NORMAL_POLL_INTERVAL, SSR } from '@/lib/constants'

const SET_CUSTOM_DOMAIN = gql`
  mutation SetCustomDomain($subName: String!, $domain: String!) {
    setCustomDomain(subName: $subName, domain: $domain) {
      domain
      dnsState
      sslState
    }
  }
`

const GET_CUSTOM_DOMAIN = gql`
  query CustomDomain($subName: String!) {
    customDomain(subName: $subName) {
      domain
      dnsState
      sslState
      verificationCname
      verificationCnameValue
      verificationTxt
      lastVerifiedAt
    }
  }
`

// TODO: clean this up
export default function CustomDomainForm ({ sub }) {
  const [setCustomDomain] = useMutation(SET_CUSTOM_DOMAIN, {
    refetchQueries: ['Sub']
  })
  const { data, stopPolling } = useQuery(GET_CUSTOM_DOMAIN, SSR
    ? {}
    : {
        variables: { subName: sub.name },
        pollInterval: NORMAL_POLL_INTERVAL,
        skip: !sub || !sub.customDomain,
        onCompleted: (data) => {
          if (data?.customDomain?.sslState === 'VERIFIED' &&
              data?.customDomain?.dnsState === 'VERIFIED') {
            stopPolling()
          }
        }
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
        domain: sub.customDomain?.domain || ''
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
              {data?.customDomain && (
                <>
                  <div className='d-flex align-items-center gap-2'>
                    <ActionTooltip overlayText={new Date(data?.customDomain.lastVerifiedAt).toUTCString()}>
                      {getStatusBadge(data?.customDomain.dnsState)}
                    </ActionTooltip>
                    {getSSLStatusBadge(data?.customDomain.sslState)}
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
      {(data?.customDomain.dnsState === 'PENDING' || data?.customDomain.dnsState === 'FAILED') && (
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
            Value: ${data?.customDomain.verificationTxt}
          </pre>
        </>
      )}
      {data?.customDomain.sslState === 'PENDING' && (
        <>
          <h6>SSL verification pending</h6>
          <p>We issued an SSL certificate for your domain. To validate it, add the following CNAME record:</p>
          <pre>
            CNAME:
            Host: ${data?.customDomain.verificationCname}
            Value: ${data?.customDomain.verificationCnameValue}
          </pre>
        </>
      )}
    </Form>
  )
}
