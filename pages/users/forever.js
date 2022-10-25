import { gql } from '@apollo/client'
import { getGetServerSideProps } from '../../api/ssrApollo'
import Layout from '../../components/layout'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Col, Row } from 'react-bootstrap'
import { abbrNum } from '../../lib/format'
import { UsageHeader } from '../../components/usage-header'

export const getServerSideProps = getGetServerSideProps(
  gql`
    {
      registrationGrowth {
        time
        invited
        organic
      }
      activeGrowth {
        time
        num
      }
      itemGrowth {
        time
        jobs
        comments
        posts
      }
      spentGrowth {
        time
        jobs
        fees
        boost
        tips
      }
      stackedGrowth {
        time
        posts
        comments
        rewards
      }
      earnerGrowth {
        time
        num
      }
    }`)

const dateFormatter = timeStr => {
  const date = new Date(timeStr)
  return `${('0' + (date.getUTCMonth() % 12 + 1)).slice(-2)}/${String(date.getUTCFullYear()).slice(-2)}`
}

export default function Growth ({
  data: { registrationGrowth, activeGrowth, itemGrowth, spentGrowth, earnerGrowth, stackedGrowth }
}) {
  return (
    <Layout>
      <UsageHeader />
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold invisible'>stackers</div>
          <GrowthLineChart data={earnerGrowth} xName='month' yName='stackers' />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>stacking</div>
          <GrowthAreaChart data={stackedGrowth} xName='month' />
        </Col>
      </Row>
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>items</div>
          <GrowthAreaChart data={itemGrowth} xName='month' />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>spending</div>
          <GrowthAreaChart data={spentGrowth} xName='month' yName='sats spent' />
        </Col>
      </Row>
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>registrations</div>
          <GrowthAreaChart data={registrationGrowth} xName='month' yName='registrations' />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold invisible'>spenders</div>
          <GrowthLineChart data={activeGrowth} xName='month' yName='spenders' />
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

function GrowthAreaChart ({ data, xName, title }) {
  if (!data || data.length === 0) {
    return null
  }
  return (
    <ResponsiveContainer width='100%' height={300} minWidth={300}>
      <AreaChart
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
        <YAxis tickFormatter={abbrNum} tick={{ fill: 'var(--theme-grey)' }} />
        <Tooltip labelFormatter={dateFormatter} contentStyle={{ color: 'var(--theme-color)', backgroundColor: 'var(--theme-body)' }} />
        <Legend />
        {Object.keys(data[0]).filter(v => v !== 'time' && v !== '__typename').map((v, i) =>
          <Area key={v} type='monotone' dataKey={v} name={v} stackId='1' stroke={COLORS[i]} fill={COLORS[i]} />)}
      </AreaChart>
    </ResponsiveContainer>
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
        <YAxis tickFormatter={abbrNum} tick={{ fill: 'var(--theme-grey)' }} />
        <Tooltip labelFormatter={dateFormatter} contentStyle={{ color: 'var(--theme-color)', backgroundColor: 'var(--theme-body)' }} />
        <Legend />
        <Line type='monotone' dataKey='num' name={yName} stroke='var(--secondary)' />
      </LineChart>
    </ResponsiveContainer>
  )
}
