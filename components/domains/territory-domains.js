import { Badge } from 'react-bootstrap'
import { Form, Input, SubmitButton } from '../form'
import { useMutation, useQuery } from '@apollo/client'
import { customDomainSchema } from '@/lib/validate'
import ActionTooltip from '../action-tooltip'
import { useToast } from '@/components/toast'
import { NORMAL_POLL_INTERVAL, SSR } from '@/lib/constants'
import { GET_CUSTOM_DOMAIN, SET_CUSTOM_DOMAIN } from '@/fragments/domains'
import { useEffect, createContext, useContext, useState } from 'react'
import { useRouter } from 'next/router'
import { signIn } from 'next-auth/react'

// Domain context for custom domains
const DomainContext = createContext({
  isCustomDomain: false
})

export const DomainProvider = ({ isCustomDomain: initialIsCustomDomain, children }) => {
  const router = useRouter()
  const [isCustomDomain, setIsCustomDomain] = useState(initialIsCustomDomain)

  useEffect(() => {
    // client side navigation
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      const isCustom = hostname !== new URL(process.env.NEXT_PUBLIC_URL).hostname
      setIsCustomDomain(isCustom)
    }
  }, [router.asPath])

  // TODO: alternative to this, for test only
  // auth sync
  useEffect(() => {
    console.log(router.query)
    if (router.query.type === 'sync') {
      console.log('signing in with sync')
      signIn('sync', { token: router.query.token, callbackUrl: router.query.callbackUrl, multiAuth: router.query.multiAuth, redirect: false })
    }
  }, [router.query.type])

  return (
    <DomainContext.Provider value={{ isCustomDomain }}>
      {children}
    </DomainContext.Provider>
  )
}

export const useDomain = () => useContext(DomainContext)

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

const getSSLStatusBadge = (status) => {
  switch (status) {
    case 'VERIFIED':
      return <Badge bg='success'>SSL verified</Badge>
    case 'PENDING':
      return <Badge bg='warning'>SSL pending</Badge>
    case 'FAILED':
      return <Badge bg='danger'>SSL failed</Badge>
    case 'WAITING':
      return <Badge bg='info'>SSL waiting</Badge>
  }
}

export function DomainLabel ({ customDomain }) {
  const { domain, dnsState, sslState, lastVerifiedAt } = customDomain || {}
  return (
    <div className='d-flex align-items-center gap-2'>
      <span>custom domain</span>
      {domain && (
        <ActionTooltip overlayText={lastVerifiedAt ? new Date(lastVerifiedAt).toLocaleString() : ''}>
          <div className='d-flex align-items-center gap-2'>
            {getStatusBadge(dnsState)}
            {getSSLStatusBadge(sslState)}
          </div>
        </ActionTooltip>
      )}
    </div>
  )
}

export function DomainGuidelines ({ customDomain }) {
  const { domain, dnsState, sslState, verificationTxt, verificationCname, verificationCnameValue } = customDomain || {}
  return (
    <>
      {(dnsState && dnsState !== 'VERIFIED') && (
        <>
          <h5>Step 1: Verify your domain</h5>
          <p>Add the following DNS records to verify ownership of your domain:</p>
          <h6>CNAME</h6>
          <p>
            Host: <pre>{domain || 'www'}</pre>
            Value: <pre>stacker.news</pre>
          </p>
          <h6>TXT</h6>
          <p>
            Host: <pre>{domain || 'www'}</pre>
            Value: <pre>{verificationTxt}</pre>
          </p>
        </>
      )}
      {sslState === 'PENDING' && (
        <>
          <h5>Step 2: Prepare your domain for SSL</h5>
          <p>We issued an SSL certificate for your domain. To validate it, add the following CNAME record:</p>
          <h6>CNAME</h6>
          <p>
            Host: <pre>{verificationCname || 'waiting for SSL certificate'}</pre>
            Value: <pre>{verificationCnameValue || 'waiting for SSL certificate'}</pre>
          </p>
        </>
      )}
    </>
  )
}

// TODO: clean this up, might not need all this refreshing, plus all this polling is not done correctly
export default function CustomDomainForm ({ sub }) {
  const [setCustomDomain] = useMutation(SET_CUSTOM_DOMAIN)

  // Get the custom domain and poll for changes
  const { data, startPolling, stopPolling, refetch } = useQuery(GET_CUSTOM_DOMAIN, SSR
    ? {}
    : { variables: { subName: sub.name } })
  const toaster = useToast()

  const { domain, sslState, dnsState } = data?.customDomain || {}

  // Stop polling when the domain is verified
  useEffect(() => {
    if (sslState === 'VERIFIED' && dnsState === 'VERIFIED') {
      stopPolling()
    } else {
      startPolling(NORMAL_POLL_INTERVAL)
    }
  }, [data, stopPolling])

  // Update the custom domain
  const onSubmit = async ({ domain }) => {
    try {
      stopPolling()
      await setCustomDomain({
        variables: {
          subName: sub.name,
          domain
        }
      })
      refetch()
      startPolling(NORMAL_POLL_INTERVAL)
      toaster.success('domain updated successfully')
    } catch (error) {
      toaster.danger('failed to update domain', { error })
    }
  }

  return (
    <>
      <Form
        initial={{ domain: domain || sub.customDomain?.domain }}
        schema={customDomainSchema}
        onSubmit={onSubmit}
        className='mb-2'
      >
        {/* TODO: too many flexes */}
        <div className='d-flex align-items-center gap-2'>
          <Input
            label={<DomainLabel customDomain={data?.customDomain} />}
            name='domain'
            placeholder='www.example.com'
          />
          <SubmitButton variant='primary' className='mt-3'>save</SubmitButton>
        </div>
      </Form>
      <DomainGuidelines customDomain={data?.customDomain} />
    </>
  )
}
