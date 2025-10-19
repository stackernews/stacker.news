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

export default function Growth ({ ssrData }) {
  const router = useRouter()
  const { when, from, to, sub } = router.query
  console.log(sub)

  const { data } = useQuery(GROWTH_QUERY, { variables: { when, from, to, sub, subSelect: sub !== 'all' } })
  if (!data && !ssrData) return <PageLoading />

  const {
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
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>stackers</div>
          <WhenLineChart data={stackerGrowth} />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>stacking</div>
          <WhenAreaChart data={stackingGrowth} />
        </Col>
      </Row>
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>spenders</div>
          <WhenLineChart data={spenderGrowth} />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>spending</div>
          <WhenAreaChart data={spendingGrowth} />
        </Col>
      </Row>
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>counts</div>
          <WhenLineChart data={itemGrowth} />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>registrations</div>
          <WhenAreaChart data={registrationGrowth} />
        </Col>
      </Row>
    </Layout>
  )
}
