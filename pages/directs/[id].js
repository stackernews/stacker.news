import { useQuery } from '@apollo/client'
import { CenterLayout } from '@/components/layout'
import { CopyInput, InputSkeleton } from '@/components/form'
import { useRouter } from 'next/router'
import { DIRECT } from '@/fragments/wallet'
import { SSR, FAST_POLL_INTERVAL } from '@/lib/constants'
import Bolt11Info from '@/components/bolt11-info'
import { getGetServerSideProps } from '@/api/ssrApollo'
import InvoiceStatus from '@/components/invoice-status'
import { PrivacyOption } from '../withdrawals/[id]'
import { InvoiceExtras } from '@/components/invoice'
// force SSR to include CSP nonces
export const getServerSideProps = getGetServerSideProps({ query: null })

export default function Direct () {
  return (
    <CenterLayout>
      <LoadDirect />
    </CenterLayout>
  )
}

export function DirectSkeleton ({ status }) {
  return (
    <>
      <div className='w-100 form-group'>
        <InputSkeleton label='invoice' />
      </div>
      <div className='w-100 mt-3'>
        <Bolt11Info />
      </div>
    </>
  )
}

function LoadDirect () {
  const router = useRouter()
  const { loading, error, data } = useQuery(DIRECT, SSR
    ? {}
    : {
        variables: { id: router.query.id },
        pollInterval: FAST_POLL_INTERVAL,
        nextFetchPolicy: 'cache-and-network'
      })
  if (error) return <div>error</div>
  if (!data || loading) {
    return <DirectSkeleton status='loading' />
  }

  return (
    <>
      <div className='w-100'>
        <CopyInput
          label='invoice' type='text'
          placeholder={data.direct.bolt11 || 'deleted'} readOnly noForm
        />
        <InvoiceStatus variant='pending' status={`direct payment of ${data.direct.sats} sats`} />
      </div>
      <div className='w-100 mt-3'>
        <InvoiceExtras {...data.direct} />
        <Bolt11Info bolt11={data.direct.bolt11} preimage={data.direct.preimage} />
        <div className='w-100 mt-3'>
          <PrivacyOption payment={data.direct} />
        </div>
      </div>
    </>
  )
}
