import { Badge, Button } from 'react-bootstrap'
import { Form, Input, SubmitButton, CopyButton } from './form'
import { useMutation } from '@apollo/client/react'
import { customDomainSchema } from '@/lib/validate'
import { useToast } from '@/components/toast'
import { SET_DOMAIN } from '@/fragments/domains'
import { useEffect, useState, createContext, useContext, useMemo } from 'react'
import Moon from '@/svgs/moon-fill.svg'
import ClipboardLine from '@/svgs/clipboard-line.svg'
import styles from './territory-domains.module.css'
import { getSeoWithFallback } from '@/lib/domains/seo'

const DomainContext = createContext({ domain: null, seo: null })

export const DomainProvider = ({ domain: ssrDomain, children }) => {
  const [domain, setDomain] = useState(ssrDomain ?? null)

  // maintain the custom domain state across re-renders and nodata navigations
  useEffect(() => {
    if (ssrDomain !== undefined) {
      setDomain(ssrDomain)
    }
  }, [ssrDomain])

  const seo = useMemo(
    () => domain
      ? getSeoWithFallback(domain)
      : null,
    [domain])

  const value = useMemo(() => ({ domain, seo }), [domain, seo])

  return (
    <DomainContext.Provider value={value}>
      {children}
    </DomainContext.Provider>
  )
}

/** returns active custom domain data and territory branding for the current host */
export const useDomain = () => useContext(DomainContext)

export function usePrefix (sub) {
  const { domain } = useDomain()
  if (domain) return ''
  return sub ? `/~${sub}` : ''
}

export function useNavKeys (path, sub) {
  const { domain } = useDomain()
  const offset = domain ? 1 : (sub ? 2 : 1)
  return {
    topNavKey: path.split('/')[offset] ?? '',
    dropNavKey: path.split('/').slice(offset).join('/')
  }
}

const getStatusBadge = (type, status) => {
  switch (status) {
    case 'VERIFIED':
      return <Badge bg='success'>{type} verified</Badge>
    default:
      return <Badge bg='warning'>{type} pending</Badge>
  }
}

const DomainLabel = ({ domain, polling }) => {
  const { status, records } = domain || {}

  return (
    <div className='d-flex align-items-center gap-2'>
      <span>custom domain</span>
      {domain && (
        <div className='d-flex align-items-center gap-2'>
          {status === 'PENDING'
            ? (
              <>
                {getStatusBadge('CNAME', records?.CNAME?.status)}
                {getStatusBadge('SSL', records?.SSL?.status)}
              </>
              )
            : status === 'HOLD'
              ? <Badge bg='secondary'>HOLD</Badge>
              : <Badge bg='success'>active</Badge>}
          {polling && <Moon className={`spin fill-grey ${styles.statusIcon}`} />}
        </div>
      )}
    </div>
  )
}

const DomainGuidelines = ({ domain }) => {
  const { records } = domain || {}

  const dnsRecord = ({ record }) => {
    return (
      <div className='d-flex align-items-center gap-2 flex-wrap'>
        <span className={styles.record}>
          <small className='fw-bold text-muted d-flex align-items-center gap-1 position-relative'>
            host
            <CopyButton
              value={record?.recordName}
              append={<ClipboardLine className={styles.clipboard} />}
            />
          </small>
          <pre>{record?.recordName}</pre>
        </span>
        <span className={styles.record}>
          <small className='fw-bold text-muted d-flex align-items-center gap-1 position-relative'>
            value
            <CopyButton
              value={record?.recordValue}
              append={<ClipboardLine className={styles.clipboard} />}
            />
          </small>
          <pre>{record?.recordValue}</pre>
        </span>
      </div>
    )
  }

  /**
   * CNAME pending -> show only Step 1
   * CNAME verified but no SSL -> show placeholder
   * CNAME verified and SSL is pending -> show Step 2
   */
  return (
    <div className='d-flex'>
      {records?.CNAME?.status === 'PENDING' && (
        <div className='d-flex flex-column gap-2'>
          <h5>Step 1: Verify your domain</h5>
          <p>Add the following DNS record to verify ownership of your domain:</p>
          <h6>CNAME</h6>
          {dnsRecord({ record: records?.CNAME })}
        </div>
      )}
      {records?.CNAME?.status === 'VERIFIED' && !records?.SSL && (
        <p>CNAME verified. Requesting SSL certificate...</p>
      )}
      {records?.CNAME?.status === 'VERIFIED' && records?.SSL?.status === 'PENDING' && (
        <div className=''>
          <h5>Step 2: Prepare your domain for SSL</h5>
          <p>We've issued an SSL certificate for your domain. To validate it, add the following CNAME record:</p>
          <h6>CNAME</h6>
          {dnsRecord({ record: records?.SSL })}
        </div>
      )}
    </div>
  )
}

export default function CustomDomainForm ({ sub, domain, onDomainChanged }) {
  const [setDomain] = useMutation(SET_DOMAIN)

  const toaster = useToast()

  const { domainName, status } = domain || {}
  const polling = status === 'PENDING'

  // Update the custom domain
  const onSubmit = async ({ domainName }) => {
    try {
      await setDomain({
        variables: {
          subName: sub.name,
          domainName
        }
      })
      await onDomainChanged?.()
      if (domainName) {
        toaster.success('started domain verification')
      } else {
        toaster.success('domain removed successfully')
      }
    } catch (error) {
      toaster.danger(error.message)
    }
  }

  return (
    <>
      <Form
        initial={{ domainName: domainName || '' }}
        schema={customDomainSchema}
        enableReinitialize
        onSubmit={onSubmit}
        className='mb-2'
      >
        <div className='d-flex align-items-center gap-2'>
          <div className='flex-grow-1'>
            <Input
              disabled={!!domain}
              label={<DomainLabel domain={domain} polling={polling} />}
              name='domainName'
              placeholder='www.example.com'
            />
          </div>
          {domain && (
            <Button
              variant='danger'
              className='mt-3'
              onClick={() => onSubmit({ domainName: '' })}
            >
              reset
            </Button>
          )}
          {!domain
            ? (
              <SubmitButton variant='primary' className='mt-3'>verify</SubmitButton>
              )
            : domain?.status === 'HOLD'
              ? (
                <SubmitButton variant='success' className='mt-3'>re-verify</SubmitButton>
                )
              : null}
        </div>
      </Form>
      {domain && domain?.status === 'PENDING' && (
        <DomainGuidelines domain={domain} />
      )}
    </>
  )
}
