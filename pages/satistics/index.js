import { useQuery } from '@apollo/client'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import MoreFooter from '@/components/more-footer'
import { SATISTICS } from '@/fragments/payIn'
import PayInTable, { PayInSkeleton } from '@/components/payIn/table'
import { useData } from '@/components/use-data'

export const getServerSideProps = getGetServerSideProps({ query: SATISTICS, authRequired: true, variables: { } })

export default function Satistics ({ ssrData }) {
  const { data, fetchMore } = useQuery(SATISTICS, { variables: { } })
  const dat = useData(data, ssrData)
  if (!dat) {
    return (
      <Layout>
        <div className='mt-2'>
          <div className='py-2 px-0 mb-0 mw-100'>
            <PayInSkeleton header />
          </div>
        </div>
      </Layout>
    )
  }

  const { satistics: { payIns, cursor } } = dat

  return (
    <Layout>
      <div className='mt-2'>
        <div className='py-2 px-0 mb-0 mw-100'>
          <PayInTable payIns={payIns} />
        </div>
        <MoreFooter cursor={cursor} count={payIns?.length} fetchMore={fetchMore} Skeleton={PayInSkeleton} />
      </div>
    </Layout>
  )
}
