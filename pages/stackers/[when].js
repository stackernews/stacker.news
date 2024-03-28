import { gql, useQuery } from '@apollo/client'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import { UsageHeader } from '@/components/usage-header'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import PageLoading from '@/components/page-loading'
import { WhenAreaChartSkeleton, WhenComposedChartSkeleton, WhenLineChartSkeleton } from '@/components/charts-skeletons'

const WhenAreaChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenAreaChart), {
  loading: () => <WhenAreaChartSkeleton />
})
const WhenLineChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenLineChart), {
  loading: () => <WhenLineChartSkeleton />
})
const WhenComposedChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenComposedChart), {
  loading: () => <WhenComposedChartSkeleton />
})

const GROWTH_QUERY = gql`
  query Growth($when: String!, $from: String, $to: String)
  {
    registrationGrowth(when: $when, from: $from, to: $to) {
      time
      data {
        name
        value
      }
    }
    itemGrowth(when: $when, from: $from, to: $to) {
      time
      data {
        name
        value
      }
    }
    spendingGrowth(when: $when, from: $from, to: $to) {
      time
      data {
        name
        value
      }
    }
    spenderGrowth(when: $when, from: $from, to: $to) {
      time
      data {
        name
        value
      }
    }
    stackingGrowth(when: $when, from: $from, to: $to) {
      time
      data {
        name
        value
      }
    }
    stackerGrowth(when: $when, from: $from, to: $to) {
      time
      data {
        name
        value
      }
    }
  }`

export const getServerSideProps = getGetServerSideProps({ query: GROWTH_QUERY })

export default function Growth ({ ssrData }) {
  const router = useRouter()
  const { when, from, to } = router.query

  const { data } = useQuery(GROWTH_QUERY, { variables: { when, from, to } })
  if (!data && !ssrData) return <PageLoading />

  const { registrationGrowth, itemGrowth, spendingGrowth, spenderGrowth, stackingGrowth, stackerGrowth } = data || ssrData

  return (
    <Layout>
      <UsageHeader />
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
          <div className='text-center text-muted fw-bold'>registrations</div>
          <WhenAreaChart data={registrationGrowth} />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>items</div>
          <WhenComposedChart data={itemGrowth} areaNames={['posts', 'comments', 'jobs']} areaAxis='left' lineNames={['comments/posts', 'territories']} lineAxis='right' barNames={['zaps']} />
        </Col>
      </Row>
    </Layout>
  )
}
