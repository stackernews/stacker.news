import { gql } from '@apollo/client'
import { getGetServerSideProps } from '../../api/ssrApollo'
import Layout from '../../components/layout'
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Col, Row } from 'react-bootstrap'
import { UsageHeader } from '../../components/usage-header'

export const getServerSideProps = getGetServerSideProps(
  gql`
    {
      registrationsWeekly
      activeWeekly
      earnersWeekly
      itemsWeekly {
        name
        value
      }
      spentWeekly {
        name
        value
      }
      stackedWeekly {
        name
        value
      }
    }`)

export default function Growth ({
  data: {
    registrationsWeekly, activeWeekly, itemsWeekly, spentWeekly,
    stackedWeekly, earnersWeekly
  }
}) {
  return (
    <Layout>
      <UsageHeader />
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>registrations</div>
          <h3 className='text-center'>{registrationsWeekly}</h3>
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>spenders</div>
          <h3 className='text-center'>{activeWeekly}</h3>
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>stackers</div>
          <h3 className='text-center'>{earnersWeekly}</h3>
        </Col>
      </Row>
      <Row>
        <Col className='mt-3 p-0'>
          <div className='text-center text-muted font-weight-bold'>items</div>
          <GrowthPieChart data={itemsWeekly} />
        </Col>
        <Col className='mt-3 p-0'>
          <div className='text-center text-muted font-weight-bold'>spent</div>
          <GrowthPieChart data={spentWeekly} />
        </Col>
        <Col className='mt-3 p-0'>
          <div className='text-center text-muted font-weight-bold'>stacked</div>
          <GrowthPieChart data={stackedWeekly} />
        </Col>
      </Row>
    </Layout>
  )
}

const COLORS = [
  'var(--secondary)',
  'var(--info)',
  'var(--success)',
  'var(--boost)',
  'var(--grey)'
]

function GrowthPieChart ({ data }) {
  return (
    <ResponsiveContainer width='100%' height={250} minWidth={200}>
      <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <Pie
          dataKey='value'
          isAnimationActive={false}
          data={data}
          cx='50%'
          cy='50%'
          outerRadius={80}
          fill='var(--secondary)'
          label
        >
          {
            data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))
          }
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}
