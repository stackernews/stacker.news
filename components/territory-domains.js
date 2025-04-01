import { Badge } from 'react-bootstrap'
import { Form, Input, SubmitButton } from './form'
import { useMutation, useQuery } from '@apollo/client'
import { customDomainSchema } from '@/lib/validate'
import ActionTooltip from './action-tooltip'
import { useToast } from '@/components/toast'
import { NORMAL_POLL_INTERVAL, SSR } from '@/lib/constants'
import { GET_CUSTOM_DOMAIN, SET_CUSTOM_DOMAIN } from '@/fragments/domains'
import { useEffect, createContext, useContext, useState } from 'react'
import { useRouter } from 'next/router'
import { signIn } from 'next-auth/react'
import BrandingForm from '@/components/territory-branding-form'
import Head from 'next/head'

// Domain context for custom domains
const DomainContext = createContext({
  customDomain: {
    domain: null,
    subName: null,
    branding: null
  }
})

export const DomainProvider = ({ customDomain: ssrCustomDomain, children }) => {
  const router = useRouter()
  const [customDomain, setCustomDomain] = useState(ssrCustomDomain || null)

  useEffect(() => {
    if (ssrCustomDomain && !customDomain) {
      setCustomDomain(ssrCustomDomain)
    }
  }, [ssrCustomDomain])

  // TODO: alternative to this, for test only
  // auth sync
  useEffect(() => {
    if (router.query.type === 'sync') {
      console.log('signing in with sync')
      signIn('sync', { token: router.query.token, callbackUrl: router.query.callbackUrl, multiAuth: router.query.multiAuth, redirect: false })
    }
  }, [router.query.type])

  const branding = customDomain?.branding || null

  return (
    <DomainContext.Provider value={{ customDomain }}>
      {branding && (
        <>
          <Head>
            {branding?.title && <title>{branding?.title}</title>}
            {branding?.favicon && <link rel='icon' href={branding.favicon} />}
          </Head>
          {branding?.primaryColor && <CustomStyles branding={branding} />}
        </>
      )}
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
      {dnsState === 'VERIFIED' && sslState === 'VERIFIED' &&
        <BrandingForm sub={sub} />}
    </>
  )
}

export function CustomStyles ({ branding }) {
  useEffect(() => {
    if (branding && branding.primaryColor) {
      // TODO: mvp placeholder transition
      document.documentElement.style.setProperty('--bs-transition', 'all 0.3s ease')
      const styleElement = document.createElement('style')
      styleElement.textContent = `
        .btn-primary, .btn-secondary,
        .bg-primary, .bg-secondary,
        .text-primary, .text-secondary,
        .border-primary, .border-secondary,
        svg,
        [class*="btn-outline-primary"], [class*="btn-outline-secondary"],
        [style*="--bs-primary"], [style*="--bs-secondary"] {
          transition: var(--bs-transition);
        }
      `
      document.head.appendChild(styleElement)
      // dynamic colors
      document.documentElement.style.setProperty('--bs-primary', branding.primaryColor)
      document.documentElement.style.setProperty('--bs-secondary', branding.secondaryColor)
      // hex to rgb for compat
      document.documentElement.style.setProperty('--bs-primary-rgb', hexToRgb(branding.primaryColor))
      document.documentElement.style.setProperty('--bs-secondary-rgb', hexToRgb(branding.secondaryColor))
      return () => {
        // TODO: not sure if this is a good practice: reset to default values when component unmounts
        document.documentElement.style.removeProperty('transition')
        document.documentElement.style.removeProperty('--bs-primary')
        document.documentElement.style.removeProperty('--bs-secondary')
        document.documentElement.style.removeProperty('--bs-primary-rgb')
        document.documentElement.style.removeProperty('--bs-secondary-rgb')
      }
    }
  }, [branding])
}

// hex to rgb for compat
function hexToRgb (hex) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}
