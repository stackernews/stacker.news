import { useQuery } from '@apollo/client'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import { USER_STATS } from '@/fragments/users'
import { useRouter } from 'next/router'
import PageLoading from '@/components/page-loading'
import dynamic from 'next/dynamic'
import { numWithUnits } from '@/lib/format'
import { UsageHeader } from '@/components/usage-header'
import { SatisticsHeader } from '../history'

export const getServerSideProps = getGetServerSideProps({ query: USER_STATS, authRequired: true })

const WhenAreaChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenAreaChart), {
  loading: () => <div>Loading...</div>
})
const WhenLineChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenLineChart), {
  loading: () => <div>Loading...</div>
})

export default function Satistics ({ ssrData }) {
  const router = useRouter()
  const { when, from, to } = router.query

  const userStats = useQuery(USER_STATS, { variables: { when, from, to } })
  const { userStatsActions, userStatsIncomingSats, userStatsOutgoingSats } = userStats.data || {}

  if (!userStatsActions && !userStatsIncomingSats && !userStatsOutgoingSats) return <PageLoading />

  const totalStacked = userStatsIncomingSats.reduce((total, a) => total + a.data?.reduce((acc, d) => acc + d.value, 0), 0)
  const totalSpent = userStatsOutgoingSats.reduce((total, a) => total + a.data?.reduce((acc, d) => acc + d.value, 0), 0)
  const totalEngagement = userStatsActions.reduce((total, a) => total + a.data?.reduce((acc, d) => acc + d.value, 0), 0)

  return (
    <Layout>
      <div className='mt-2'>
        <SatisticsHeader />
        <div className='tab-content' id='myTabContent'>
          <div className='tab-pane fade show active' id='statistics' role='tabpanel' aria-labelledby='statistics-tab'>
            <UsageHeader pathname='satistics/graphs' />
            <div>
              <div className='d-flex row justify-content-between'>
                <div className='col-md-4 mb-2'>
                  <h4>Stacked</h4>
                  <div className='card'>
                    <div className='card-body'>
                      <h1 className='text-center text-nowrap'>
                        {numWithUnits(totalStacked, { abbreviate: false, format: true })}
                      </h1>
                    </div>
                  </div>
                </div>
                <div className='col-md-4 mb-2'>
                  <h4>Spent</h4>
                  <div className='card'>
                    <div className='card-body'>
                      <h1 className='text-center text-nowrap'>
                        {numWithUnits(totalSpent, { abbreviate: false, format: true })}
                      </h1>
                    </div>
                  </div>
                </div>
                <div className='col-md-4'>
                  <h4>Actions</h4>
                  <div className='card'>
                    <div className='card-body'>
                      <h1 className='text-center'>
                        {new Intl.NumberFormat().format(totalEngagement)}
                      </h1>
                    </div>
                  </div>
                </div>
              </div>
              <div className='row mt-5'>
                <div className='col-md-6'>
                  <div className='text-center text-muted fw-bold'>stacking</div>
                  <WhenLineChart data={userStatsIncomingSats} />
                </div>
                <div className='col-md-6'>
                  <div className='text-center text-muted fw-bold'>spending</div>
                  <WhenLineChart data={userStatsOutgoingSats} />
                </div>
              </div>
              <div className='row'>
                <div className='col-md-12'>
                  <div className='text-center text-muted fw-bold'>items</div>
                  <WhenAreaChart data={userStatsActions} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
