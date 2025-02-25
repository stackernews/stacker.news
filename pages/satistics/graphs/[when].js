import { useQuery } from '@apollo/client'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import { USER_STATS } from '@/fragments/users'
import { useRouter } from 'next/router'
import PageLoading from '@/components/page-loading'
import dynamic from 'next/dynamic'
import { numWithUnits } from '@/lib/format'
import { UserAnalyticsHeader } from '@/components/user-analytics-header'
import { SatisticsHeader } from '..'
import { WhenComposedChartSkeleton, WhenAreaChartSkeleton } from '@/components/charts-skeletons'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'

export const getServerSideProps = getGetServerSideProps({ query: USER_STATS, authRequired: true })

const WhenAreaChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenAreaChart), {
  loading: () => <WhenAreaChartSkeleton />
})
const WhenComposedChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenComposedChart), {
  loading: () => <WhenComposedChartSkeleton />
})

const SatisticsTooltip = ({ children, overlayText }) => {
  return (
    <OverlayTrigger
      placement='bottom'
      overlay={
        <Tooltip>
          {overlayText}
        </Tooltip>
      }
    >
      <span>
        {children}
      </span>
    </OverlayTrigger>
  )
}

export default function Satistics ({ ssrData }) {
  const router = useRouter()
  const { when, from, to } = router.query

  const { data } = useQuery(USER_STATS, { variables: { when, from, to } })
  if (!data && !ssrData) return <PageLoading />
  const { userStatsActions, userStatsIncomingSats, userStatsOutgoingSats } = data || ssrData

  const totalStacked = userStatsIncomingSats.reduce((total, a) => total + a.data?.reduce((acc, d) => acc + d.value, 0), 0)
  const totalSpent = userStatsOutgoingSats.reduce((total, a) => total + a.data?.reduce((acc, d) => acc + d.value, 0), 0)

  return (
    <Layout>
      <div className='mt-2'>
        <SatisticsHeader />
        <div className='tab-content' id='myTabContent'>
          <div className='tab-pane fade show active text-muted' id='statistics' role='tabpanel' aria-labelledby='statistics-tab'>
            <UserAnalyticsHeader pathname='satistics/graphs' />
            <div className='mt-3'>
              <div className='d-flex row justify-content-between'>
                <div className='col-md-6 mb-2'>
                  <h4 className='w-100 text-center'>stacked</h4>
                  <div className='card'>
                    <div className='card-body'>
                      <SatisticsTooltip overlayText={numWithUnits(totalStacked, { abbreviate: false, format: true })}>
                        <h2 className='text-center text-nowrap mb-0 text-muted'>
                          {numWithUnits(totalStacked, { abbreviate: true, format: true })}
                        </h2>
                      </SatisticsTooltip>
                    </div>
                  </div>
                </div>
                <div className='col-md-6 mb-2'>
                  <h4 className='w-100 text-center'>spent</h4>
                  <div className='card'>
                    <div className='card-body'>
                      <SatisticsTooltip overlayText={numWithUnits(totalSpent, { abbreviate: false, format: true })}>
                        <h2 className='text-center text-nowrap mb-0 text-muted'>
                          {numWithUnits(totalSpent, { abbreviate: true, format: true })}
                        </h2>
                      </SatisticsTooltip>
                    </div>
                  </div>
                </div>
              </div>
              <div className='row mt-5'>
                {userStatsIncomingSats.length > 0 &&
                  <div className='col-md-6'>
                    <div className='text-center text-muted fw-bold'>stacking</div>
                    <WhenAreaChart data={userStatsIncomingSats} />
                  </div>}
                {userStatsOutgoingSats.length > 0 &&
                  <div className='col-md-6'>
                    <div className='text-center text-muted fw-bold'>spending</div>
                    <WhenAreaChart data={userStatsOutgoingSats} />
                  </div>}
              </div>
              <div className='row mt-5'>
                {userStatsActions.length > 0 &&
                  <div className='col-md-12'>
                    <div className='text-center text-muted fw-bold'>items</div>
                    <WhenComposedChart data={userStatsActions} areaNames={['posts', 'comments']} areaAxis='left' lineNames={['territories', 'referrals', 'one day referrals']} lineAxis='right' />
                  </div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
