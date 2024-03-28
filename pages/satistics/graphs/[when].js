import { useQuery } from '@apollo/client'
import Link from 'next/link'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import { WALLET_HISTORY } from '@/fragments/wallet'
import { USER_STATS } from '@/fragments/users'
import { useRouter } from 'next/router'
import PageLoading from '@/components/page-loading'
import dynamic from 'next/dynamic'
import { numWithUnits } from '@/lib/format'
import { UsageHeader } from '@/components/usage-header'

export const getServerSideProps = getGetServerSideProps({ query: WALLET_HISTORY, authRequired: true })

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

  const  handleHistoryTabClick = async () => {
    await router.push({
      pathname: '/satistics/history'
    })
  }
  return (
    <Layout >
    <div className='mt-3'>
      <ul className="nav nav-tabs" id="myTab" role="tablist">
        <li className="nav-item" role="presentation">
          <button className={`nav-link  active`} >Statistics</button>
        </li>
        <li className="nav-item" role="presentation">
          <button className={`nav-link`} onClick={() => handleHistoryTabClick()}>History</button>
        </li>
      </ul>
      <div className="tab-content" id="myTabContent">
        <div className="tab-pane fade show active" id="statistics" role="tabpanel" aria-labelledby="statistics-tab">
            <UsageHeader pathname='satistics/graphs'/>
            <div>
                <div className='d-flex row justify-content-between'>
                  <h1 className='text-center'>Statistics</h1>
                  <div className='col-md-4'>
                    <h4>Stacked</h4>
                    <div className='card'>
                      <div className='card-body'>
                        <h1 className='text-center text-nowrap'>
                          {numWithUnits(totalStacked, { abbreviate: false, format: true })}
                        </h1>
                      </div>
                    </div>
                  </div>
                  <div className='col-md-4'>
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
                    <WhenLineChart data={userStatsIncomingSats} />
                  </div>
                  <div className='col-md-6'>
                    <WhenLineChart data={userStatsOutgoingSats} />
                  </div>
                </div>
                <div className='row'>
                  <div className='col-md-12'>
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
