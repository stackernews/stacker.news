import { Badge, Button } from 'react-bootstrap'
import { Form, Input, SubmitButton, CopyButton } from './form'
import { useMutation, useQuery } from '@apollo/client/react'
import { customDomainSchema } from '@/lib/validate'
import { useToast } from '@/components/toast'
import { NORMAL_POLL_INTERVAL_MS, SSR } from '@/lib/constants'
import { GET_DOMAIN, SET_DOMAIN } from '@/fragments/domains'
import { useEffect, createContext, useContext, useState } from 'react'
import Moon from '@/svgs/moon-fill.svg'
import ClipboardLine from '@/svgs/clipboard-line.svg'
import styles from './item.module.css'

// Domain context for custom domains
const DomainContext = createContext({
  domain: {
    domainName: null,
    subName: null
  }
})

export const DomainProvider = ({ domain: ssrDomain, children }) => {
  const [domain, setDomain] = useState(ssrDomain || null)

  // maintain the custom domain state across re-renders
  useEffect(() => {
    if (ssrDomain) {
      setDomain(ssrDomain)
    }
  }, [ssrDomain])

  // TODO: Placeholder for Auth Sync

  return (
    <DomainContext.Provider value={{ domain }}>
      {/* TODO: Placeholder for Branding */}
      {children}
    </DomainContext.Provider>
  )
}

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
          {polling && <Moon className='spin fill-grey' style={{ width: '1rem', height: '1rem' }} />}
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
        <span className={`${styles.record}`}>
          <small className='fw-bold text-muted d-flex align-items-center gap-1 position-relative'>
            host
            <CopyButton
              value={record?.recordName}
              append={
                <ClipboardLine
                  className={`${styles.clipboard}`}
                  style={{ width: '1rem', height: '1rem' }}
                />
              }
            />
          </small>
          <pre>{record?.recordName}</pre>
        </span>
        <span className={`${styles.record}`}>
          <small className='fw-bold text-muted d-flex align-items-center gap-1 position-relative'>
            value
            <CopyButton
              value={record?.recordValue}
              append={
                <ClipboardLine
                  className={`${styles.clipboard}`}
                  style={{ width: '1rem', height: '1rem' }}
                />
              }
            />
          </small>
          <pre>{record?.recordValue}</pre>
        </span>
      </div>
    )
  }

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
      {records?.SSL?.status === 'PENDING' && (
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

export default function CustomDomainForm ({ sub }) {
  const [setDomain] = useMutation(SET_DOMAIN)

  // Get the custom domain and poll for changes
  const { data, refetch, stopPolling, startPolling } = useQuery(GET_DOMAIN, SSR
    ? {}
    : {
        variables: { subName: sub.name },
        nextFetchPolicy: 'cache-and-network'
      })

  useEffect(() => {
    if (data?.domain?.status !== 'PENDING') {
      stopPolling()
    } else {
      startPolling(NORMAL_POLL_INTERVAL_MS)
    }
  }, [data?.domain?.status])

  const toaster = useToast()

  const { domainName, status } = data?.domain || {}
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
      refetch()
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
        initial={{ domainName: domainName || sub?.domain?.domainName }}
        schema={customDomainSchema}
        onSubmit={onSubmit}
        className='mb-2'
      >
        <div className='d-flex align-items-center gap-2'>
          <div className='flex-grow-1'>
            <Input
              disabled={!!data?.domain}
              label={<DomainLabel domain={data?.domain} polling={polling} />}
              name='domainName'
              placeholder='www.example.com'
            />
          </div>
          {data?.domain && (
            <Button
              variant='danger'
              className='mt-3'
              onClick={() => onSubmit({ domainName: '' })}
            >
              reset
            </Button>
          )}
          {!data?.domain
            ? (
              <SubmitButton variant='primary' className='mt-3'>verify</SubmitButton>
              )
            : data?.domain?.status === 'HOLD'
              ? (
                <SubmitButton variant='success' className='mt-3'>re-verify</SubmitButton>
                )
              : null}
        </div>
      </Form>
      {data?.domain && data?.domain?.status === 'PENDING' && (
        <DomainGuidelines domain={data?.domain} />
      )}
    </>
  )
}
