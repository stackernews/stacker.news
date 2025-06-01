import { useQuery } from '@apollo/client'
import { CenterLayout } from '@/components/layout'
import { useRouter } from 'next/router'
import { DIRECT } from '@/fragments/invoice'
import { SSR, FAST_POLL_INTERVAL } from '@/lib/constants'
import Bolt11Info from '@/components/bolt11-info'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { PrivacyOption } from '../withdrawals/[id]'
import { InvoiceExtras } from '@/components/invoice'
import { numWithUnits } from '@/lib/format'
import Qr, { QrSkeleton } from '@/components/qr'
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
        <QrSkeleton status={status} />
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
      <Qr
        value={data.direct.bolt11}
        description={numWithUnits(data.direct.sats, { abbreviate: false })}
        statusVariant='pending' status='direct payment to attached wallet'
      />
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
