import { Badge } from 'react-bootstrap'
import { Form, Input, SubmitButton, CopyButton } from './form'
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
import Moon from '@/svgs/moon-fill.svg'
import ClipboardLine from '@/svgs/clipboard-line.svg'
import RefreshLine from '@/svgs/refresh-line.svg'
import styles from './item.module.css'

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

  // maintain the custom domain state across re-renders
  useEffect(() => {
    if (ssrCustomDomain && !customDomain) {
      setCustomDomain(ssrCustomDomain)
    }
  }, [ssrCustomDomain])

  // temporary auth sync
  useEffect(() => {
    if (router.query.type === 'sync') {
      console.log('signing in with sync', router.query)
      signIn('sync', {
        token: router.query.token,
        multiAuth: router.query.multiAuth,
        redirect: false
      })
      router.push(router.query.callbackUrl) // next auth redirect only supports the main domain
    }
  }, [router.query.type])

  const branding = customDomain?.branding || null
  const colors = branding?.colors || null

  return (
    <DomainContext.Provider value={{ customDomain }}>
      {branding && (
        <>
          <Head>
            {branding?.title && <title>{branding?.title}</title>}
            {branding?.favicon && <link rel='icon' href={branding.favicon} />}
          </Head>
          {colors && <CustomStyles branding={branding} />}
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
    default:
      return <Badge bg='warning'>DNS pending</Badge>
  }
}

const getSSLStatusBadge = (status) => {
  switch (status) {
    case 'VERIFIED':
      return <Badge bg='success'>SSL verified</Badge>
    case 'WAITING':
      return <Badge bg='info'>SSL waiting</Badge>
    default:
      return <Badge bg='warning'>SSL pending</Badge>
  }
}

const DomainLabel = ({ customDomain, polling }) => {
  const { domain, status, verification, lastVerifiedAt } = customDomain || {}

  return (
    <div className='d-flex align-items-center gap-2'>
      <span>custom domain</span>
      {domain && (
        <ActionTooltip overlayText={lastVerifiedAt ? new Date(lastVerifiedAt).toLocaleString() : ''}>
          <div className='d-flex align-items-center gap-2'>
            {status !== 'HOLD'
              ? (
                <>
                  {getStatusBadge(verification?.dns?.state)}
                  {getSSLStatusBadge(verification?.ssl?.state)}
                </>
                )
              : (<Badge bg='secondary'>HOLD</Badge>)}
            {status === 'HOLD' && (
              <SubmitButton variant='link' className='p-0'>
                <RefreshLine className={styles.refresh} style={{ width: '1rem', height: '1rem' }} />
              </SubmitButton>
            )}
            {polling && <Moon className='spin fill-grey' style={{ width: '1rem', height: '1rem' }} />}
          </div>
        </ActionTooltip>
      )}
    </div>
  )
}

const DomainGuidelines = ({ customDomain }) => {
  const { domain, verification } = customDomain || {}

  const dnsRecord = (host, value) => (
    <div className='d-flex align-items-center gap-2'>
      <span className={`${styles.record}`}>
        <small className='fw-bold text-muted d-flex align-items-center gap-1 position-relative'>
          host
          <CopyButton
            value={host}
            append={
              <ClipboardLine
                className={`${styles.clipboard}`}
                style={{ width: '1rem', height: '1rem' }}
              />
            }
          />
        </small>
        <pre>{host}</pre>
      </span>
      <span className={`${styles.record}`}>
        <small className='fw-bold text-muted d-flex align-items-center gap-1 position-relative'>
          value
          <CopyButton
            value={value}
            append={
              <ClipboardLine
                className={`${styles.clipboard}`}
                style={{ width: '1rem', height: '1rem' }}
              />
            }
          />
        </small>
        <pre>{value}</pre>
      </span>
    </div>
  )

  return (
    <div className='d-flex'>
      {(verification?.dns?.state && verification?.dns?.state !== 'VERIFIED') && (
        <div className='d-flex flex-column gap-2'>
          <h5>Step 1: Verify your domain</h5>
          <p>Add the following DNS records to verify ownership of your domain:</p>
          <h6>CNAME</h6>
          {dnsRecord(domain || 'www', verification?.dns?.cname)}
          <hr />
          <h6>TXT</h6>
          {dnsRecord(`_snverify.${domain}`, verification?.dns?.txt)}
        </div>
      )}
      {verification?.ssl?.state === 'PENDING' && (
        <div className=''>
          <h5>Step 2: Prepare your domain for SSL</h5>
          <p>We issued an SSL certificate for your domain. To validate it, add the following CNAME record:</p>
          <h6>CNAME</h6>
          {dnsRecord(verification?.ssl?.cname || 'waiting for SSL certificate', verification?.ssl?.value || 'waiting for SSL certificate')}
        </div>
      )}
    </div>
  )
}

export default function CustomDomainForm ({ sub }) {
  const [setCustomDomain] = useMutation(SET_CUSTOM_DOMAIN)

  // Get the custom domain and poll for changes
  const { data, refetch } = useQuery(GET_CUSTOM_DOMAIN, SSR
    ? {}
    : {
        variables: { subName: sub.name },
        pollInterval: NORMAL_POLL_INTERVAL,
        nextFetchPolicy: 'cache-and-network',
        onCompleted: ({ customDomain }) => {
          if (customDomain?.status !== 'PENDING') {
            return { pollInterval: 0 }
          }
        }
      })
  const toaster = useToast()

  const { domain, status } = data?.customDomain || {}
  const polling = status === 'PENDING'

  // Update the custom domain
  const onSubmit = async ({ domain }) => {
    try {
      await setCustomDomain({
        variables: {
          subName: sub.name,
          domain
        }
      })
      refetch()
      if (domain) {
        toaster.success('started domain verification')
      } else {
        toaster.success('domain removed successfully')
      }
    } catch (error) {
      toaster.danger('failed to update domain', { error })
    }
  }

  return (
    <>
      <Form
        initial={{ domain: domain || sub?.customDomain?.domain }}
        schema={customDomainSchema}
        onSubmit={onSubmit}
        className='mb-2'
      >
        <div className='d-flex align-items-center gap-2'>
          <Input
            label={<DomainLabel customDomain={data?.customDomain} polling={polling} />}
            name='domain'
            placeholder='www.example.com'
          />
          <SubmitButton variant='primary' className='mt-3'>save</SubmitButton>
        </div>
      </Form>
      <DomainGuidelines customDomain={data?.customDomain} />
      {status === 'ACTIVE' &&
        <BrandingForm sub={sub} />}
    </>
  )
}

export function CustomStyles ({ branding }) {
  useEffect(() => {
    const colors = branding?.colors || null
    if (colors) {
      const styleElement = document.createElement('style')
      styleElement.textContent = `
        :root {
          --bs-transition: all 0.3s ease;
          --bs-primary: ${colors.primary};
          --bs-secondary: ${colors.secondary};
          --bs-info: ${colors.info};
          --bs-success: ${colors.success};
          --bs-danger: ${colors.danger};
          --bs-primary-rgb: ${hexToRgb(colors.primary)};
          --bs-secondary-rgb: ${hexToRgb(colors.secondary)};
          --bs-info-rgb: ${hexToRgb(colors.info)};
          --bs-success-rgb: ${hexToRgb(colors.success)};
          --bs-danger-rgb: ${hexToRgb(colors.danger)};
        }

        .navbar-brand svg {
          transition: var(--bs-transition);
          fill: var(--bs-primary);
        }

        .btn-primary, .btn-secondary,
        .bg-primary, .bg-secondary,
        .text-primary, .text-secondary,
        .border-primary, .border-secondary
        [class*="btn-outline-primary"], [class*="btn-outline-secondary"],
        [style*="--bs-primary"], [style*="--bs-secondary"] {
          transition: var(--bs-transition);
        }
      `
      document.head.appendChild(styleElement)

      // Cleanup function
      return () => {
        document.head.removeChild(styleElement)
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
