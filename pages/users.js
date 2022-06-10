import { gql } from '@apollo/client'
import { getGetServerSideProps } from '../api/ssrApollo'
import Layout from '../components/layout'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Col, Row } from 'react-bootstrap'
import { formatSats } from '../lib/format'

export const getServerSideProps = getGetServerSideProps(
  gql`
    {
      registrationGrowth {
        time
        num
      }
      activeGrowth {
        time
        num
      }
      itemGrowth {
        time
        num
      }
      spentGrowth {
        time
        num
      }
    }`)

const dateFormatter = timeStr => {
  const date = new Date(timeStr)
  return `${('0' + (date.getMonth() + 1)).slice(-2)}/${String(date.getFullYear()).slice(-2)}`
}

export default function Growth ({ data: { registrationGrowth, activeGrowth, itemGrowth, spentGrowth } }) {
  return (
    <Layout>
      <Row className='mt-3'>
        <Col>
          <GrowthLineChart data={registrationGrowth} xName='month' yName='registrations' />
        </Col>
        <Col>
          <GrowthLineChart data={activeGrowth} xName='month' yName='active users' />
        </Col>
      </Row>
      <Row className='mt-3'>
        <Col>
          <GrowthLineChart data={itemGrowth} xName='month' yName='items' />
        </Col>
        <Col>
          <GrowthLineChart data={spentGrowth} xName='month' yName='sats spent' />
        </Col>
      </Row>
    </Layout>
  )
}

function GrowthLineChart ({ data, xName, yName }) {
  return (
    <ResponsiveContainer width='100%' height={300} minWidth={300}>
      <LineChart
        data={data}
        margin={{
          top: 5,
          right: 5,
          left: 0,
          bottom: 0
        }}
      >
        <XAxis
          dataKey='time' tickFormatter={dateFormatter} name={xName}
          tick={{ fill: 'var(--theme-grey)' }}
        />
        <YAxis tickFormatter={formatSats} tick={{ fill: 'var(--theme-grey)' }} />
        <Tooltip labelFormatter={dateFormatter} contentStyle={{ color: 'var(--theme-color)', backgroundColor: 'var(--theme-body)' }} />
        <Legend />
        <Line type='monotone' dataKey='num' name={yName} stroke='var(--secondary)' />
      </LineChart>
    </ResponsiveContainer>
  )
}
