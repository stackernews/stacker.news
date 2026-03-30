import { gql, useQuery } from '@apollo/client'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import { SubAnalyticsHeader } from '@/components/sub-analytics-header'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import PageLoading from '@/components/page-loading'
import { WhenAreaChartSkeleton, WhenLineChartSkeleton } from '@/components/charts-skeletons'
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
  query Growth($when: String!, $from: String, $to: String, $sub: String, $subSelect: Boolean = false)
  {
    growthTotals(when: $when, from: $from, to: $to, sub: $sub) {
      spending
      stacking
      items
      registrations
    }
    registrationGrowth(when: $when, from: $from, to: $to) @skip(if: $subSelect) {
      time
      data {
        name
        value
      }
    }
    itemGrowth(when: $when, from: $from, to: $to, sub: $sub) {
      time
      data {
        name
        value
      }
    }
    spendingGrowth(when: $when, from: $from, to: $to, sub: $sub) {
      time
      data {
        name
        value
      }
    }
    spenderGrowth(when: $when, from: $from, to: $to, sub: $sub) {
      time
      data {
        name
        value
      }
    }
    stackingGrowth(when: $when, from: $from, to: $to, sub: $sub) {
      time
      data {
        name
        value
      }
    }
    stackerGrowth(when: $when, from: $from, to: $to, sub: $sub) {
      time
      data {
        name
        value
      }
    }
  }`

const variablesFunc = vars => ({ ...vars, subSelect: vars.sub !== 'all' })
export const getServerSideProps = getGetServerSideProps({ query: GROWTH_QUERY, variables: variablesFunc })

function GrowthTotals ({ totals, sub }) {
  if (!totals) return null

  return (
    <Row className='my-4'>
      <Col xs={6} md={3} className='text-center mb-3'>
        <div className='text-muted small'>total stacked</div>
        <div className='fw-bold fs-5'>{numWithUnits(Math.floor(totals.stacking))}</div>
      </Col>
      <Col xs={6} md={3} className='text-center mb-3'>
        <div className='text-muted small'>total spent</div>
        <div className='fw-bold fs-5'>{numWithUnits(Math.floor(totals.spending))}</div>
      </Col>
      <Col xs={6} md={3} className='text-center mb-3'>
        <div className='text-muted small'>spend actions</div>
        <div className='fw-bold fs-5'>{new Intl.NumberFormat().format(totals.items)}</div>
      </Col>
      {sub === 'all' && totals.registrations !== null && (
        <Col xs={6} md={3} className='text-center mb-3'>
          <div className='text-muted small'>registrations</div>
          <div className='fw-bold fs-5'>{new Intl.NumberFormat().format(totals.registrations)}</div>
        </Col>
      )}
    </Row>
  )
}

export default function Growth ({ ssrData }) {
  const router = useRouter()
  const { when, from, to, sub } = router.query

  const { data } = useQuery(GROWTH_QUERY, { variables: { when, from, to, sub, subSelect: sub !== 'all' } })
  if (!data && !ssrData) return <PageLoading />

  const {
    growthTotals,
    registrationGrowth,
    itemGrowth,
    spendingGrowth,
    spenderGrowth,
    stackingGrowth,
    stackerGrowth
  } = data || ssrData

  return (
    <Layout>
      <SubAnalyticsHeader />
      <GrowthTotals totals={growthTotals} sub={sub} />
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>sats stacked</div>
          <WhenAreaChart data={stackingGrowth} />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>sats spent</div>
          <WhenAreaChart data={spendingGrowth} />
        </Col>
      </Row>
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>unique stackers</div>
          <WhenLineChart data={stackerGrowth} />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>unique spenders</div>
          <WhenLineChart data={spenderGrowth} />
        </Col>
      </Row>
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>spend counts</div>
          <WhenLineChart data={itemGrowth} />
        </Col>
        <Col className='mt-3'>
          {sub === 'all' && <div className='text-center text-muted fw-bold'>registrations</div>}
          <WhenAreaChart data={registrationGrowth} />
        </Col>
      </Row>
    </Layout>
  )
}
