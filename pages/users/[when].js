import { gql } from '@apollo/client'
import { getGetServerSideProps } from '../../api/ssrApollo'
import Layout from '../../components/layout'
import { Col, Row } from 'react-bootstrap'
import { UsageHeader } from '../../components/usage-header'
import { WhenLineChart, WhenAreaChart } from '../../components/when-charts'
import { useRouter } from 'next/router'

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
  data: { registrationGrowth, itemGrowth, spendingGrowth, spenderGrowth, stackingGrowth, stackerGrowth }
}) {
  const router = useRouter()
  const { when } = router.query
  const avg = ['month', 'year', 'forever'].includes(when) ? 'avg daily' : ''
  return (
    <Layout>
      <UsageHeader />
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>{avg} stackers</div>
          <WhenLineChart data={stackerGrowth} />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>stacking</div>
          <WhenAreaChart data={stackingGrowth} />
        </Col>
      </Row>
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>{avg} spenders</div>
          <WhenLineChart data={spenderGrowth} />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>spending</div>
          <WhenAreaChart data={spendingGrowth} />
        </Col>
      </Row>
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>registrations</div>
          <WhenAreaChart data={registrationGrowth} />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>items</div>
          <WhenAreaChart data={itemGrowth} />
        </Col>
      </Row>
    </Layout>
  )
}
