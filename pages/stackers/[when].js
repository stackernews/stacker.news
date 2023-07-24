import { gql } from '@apollo/client'
import { getGetServerSideProps } from '../../api/ssrApollo'
import Layout from '../../components/layout'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import { UsageHeader } from '../../components/usage-header'
import { useRouter } from 'next/router'
import dynamic from "next/dynamic"

const WhenAreaChart = dynamic(() => import('../../components/charts').then(mod => mod.WhenAreaChart), {
  loading: () => <div>Loading...</div>
});
const WhenLineChart = dynamic(() => import('../../components/charts').then(mod => mod.WhenLineChart), {
  loading: () => <div>Loading...</div>
});

export const getServerSideProps = getGetServerSideProps(
  gql`
    query Growth($when: String!)
    {
      registrationGrowth(when: $when) {
        time
        data {
          name
          value
        }
      }
      itemGrowth(when: $when) {
        time
        data {
          name
          value
        }
      }
      spendingGrowth(when: $when) {
        time
        data {
          name
          value
        }
      }
      spenderGrowth(when: $when) {
        time
        data {
          name
          value
        }
      }
      stackingGrowth(when: $when) {
        time
        data {
          name
          value
        }
      }
      stackerGrowth(when: $when) {
        time
        data {
          name
          value
        }
      }
    }`)

export default function Growth ({
  ssrData: { registrationGrowth, itemGrowth, spendingGrowth, spenderGrowth, stackingGrowth, stackerGrowth }
}) {
  const router = useRouter()
  const { when } = router.query
  const avg = ['year', 'forever'].includes(when) ? 'avg daily ' : ''

  return (
    <Layout>
      <UsageHeader />
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>{avg}stackers</div>
            <WhenLineChart data={stackerGrowth} />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>stacking</div>
            <WhenAreaChart data={stackingGrowth} />
        </Col>
      </Row>
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted fw-bold'>{avg}spenders</div>
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
            <WhenAreaChart data={itemGrowth} />
        </Col>
      </Row>
    </Layout>
  )
}
