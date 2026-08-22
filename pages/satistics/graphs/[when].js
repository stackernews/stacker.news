import { gql } from '@apollo/client'
import { useQuery } from '@apollo/client/react'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import { SatisticsHeader } from '@/pages/satistics'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import PageLoading from '@/components/page-loading'
import { WhenAreaChartSkeleton, WhenLineChartSkeleton } from '@/components/charts-skeletons'
import { UserAnalyticsHeader } from '@/components/user-analytics-header'
import { numWithUnits } from '@/lib/format'

const WhenAreaChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenAreaChart), {
  loading: () => <WhenAreaChartSkeleton />
})
const WhenLineChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenLineChart), {
  loading: () => <WhenLineChartSkeleton />
})
// const WhenComposedChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenComposedChart), {
//   loading: () => <WhenComposedChartSkeleton />
// })

const GROWTH_QUERY = gql`
  query Growth($when: String!, $from: String, $to: String)
  {
    growthTotals(when: $when, from: $from, to: $to, mine: true) {
      spending
      stacking
      items
    }
    itemGrowth(when: $when, from: $from, to: $to, mine: true) {
      time
      data {
        name
        value
      }
    }
    spendingGrowth(when: $when, from: $from, to: $to, mine: true) {
      time
      data {
        name
        value
      }
    }
    stackingGrowth(when: $when, from: $from, to: $to, mine: true) {
      time
      data {
        name
        value
      }
    }
  }`

export const getServerSideProps = getGetServerSideProps({ query: GROWTH_QUERY })

function UserGrowthTotals ({ totals }) {
  if (!totals) return null

  return (
    <div className='grid grid-cols-2 md:grid-cols-3 gap-x-8 my-6'>
      <div className='text-center mb-4'>
        <div className='text-muted small'>total stacked</div>
        <div className='font-bold text-lg'>{numWithUnits(Math.floor(totals.stacking))}</div>
      </div>
      <div className='text-center mb-4'>
        <div className='text-muted small'>total spent</div>
        <div className='font-bold text-lg'>{numWithUnits(Math.floor(totals.spending))}</div>
      </div>
      <div className='text-center mb-4'>
        <div className='text-muted small'>spend actions</div>
        <div className='font-bold text-lg'>{new Intl.NumberFormat().format(totals.items)}</div>
      </div>
    </div>
  )
}

export default function Growth ({ ssrData }) {
  const router = useRouter()
  const { when, from, to } = router.query

  const { data } = useQuery(GROWTH_QUERY, { variables: { when, from, to, mine: true } })
  if (!data && !ssrData) return <PageLoading />

  const {
    growthTotals,
    itemGrowth,
    spendingGrowth,
    stackingGrowth
  } = data || ssrData

  return (
    <Layout>
      <SatisticsHeader />
      <UserAnalyticsHeader pathname='satistics/graphs' />
      <UserGrowthTotals totals={growthTotals} />
      <div className='grid grid-cols-2 gap-x-8'>
        <div className='mt-4'>
          <div className='text-center text-muted font-bold'>sats stacked</div>
          <WhenAreaChart data={stackingGrowth} />
        </div>
        <div className='mt-4'>
          <div className='text-center text-muted font-bold'>sats spent</div>
          <WhenAreaChart data={spendingGrowth} />
        </div>
      </div>
      <div className='grid grid-cols-2 gap-x-8'>
        <div className='mt-4'>
          <div className='text-center text-muted font-bold'>spend counts</div>
          <WhenLineChart data={itemGrowth} />
        </div>
      </div>
    </Layout>
  )
}
