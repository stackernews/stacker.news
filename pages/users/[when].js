import { gql } from '@apollo/client'
import { getGetServerSideProps } from '../../api/ssrApollo'
import Layout from '../../components/layout'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Col, Row } from 'react-bootstrap'
import { abbrNum } from '../../lib/format'
import { UsageHeader } from '../../components/usage-header'
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

// todo: this needs to accomodate hours, days, months now
const dateFormatter = when => {
  return timeStr => {
    const date = new Date(timeStr)
    switch (when) {
      case 'week':
      case 'month':
        return `${('0' + (date.getUTCMonth() % 12 + 1)).slice(-2)}/${date.getUTCDate()}`
      case 'year':
      case 'forever':
        return `${('0' + (date.getUTCMonth() % 12 + 1)).slice(-2)}/${String(date.getUTCFullYear()).slice(-2)}`
      default:
        return `${date.getHours() % 12 || 12}${date.getHours() >= 12 ? 'pm' : 'am'}`
    }
  }
}

function xAxisName (when) {
  switch (when) {
    case 'week':
    case 'month':
      return 'days'
    case 'year':
    case 'forever':
      return 'months'
    default:
      return 'hours'
  }
}

const transformData = data => {
  return data.map(entry => {
    const obj = { time: entry.time }
    entry.data.forEach(entry1 => {
      obj[entry1.name] = entry1.value
    })
    return obj
  })
}

export default function Growth ({
  data: { registrationGrowth, itemGrowth, spendingGrowth, spenderGrowth, stackingGrowth, stackerGrowth }
}) {
  return (
    <Layout>
      <UsageHeader />
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>stackers</div>
          <GrowthLineChart data={stackerGrowth} />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>stacking</div>
          <GrowthAreaChart data={stackingGrowth} />
        </Col>
      </Row>
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>spenders</div>
          <GrowthLineChart data={spenderGrowth} />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>spending</div>
          <GrowthAreaChart data={spendingGrowth} />
        </Col>
      </Row>
      <Row>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>registrations</div>
          <GrowthAreaChart data={registrationGrowth} />
        </Col>
        <Col className='mt-3'>
          <div className='text-center text-muted font-weight-bold'>items</div>
          <GrowthAreaChart data={itemGrowth} />
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
  'var(--theme-grey)',
  'var(--danger)'
]

function GrowthAreaChart ({ data }) {
  const router = useRouter()
  if (!data || data.length === 0) {
    return null
  }
  // transform data into expected shape
  data = transformData(data)
  // need to grab when
  const when = router.query.when

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
          dataKey='time' tickFormatter={dateFormatter(when)} name={xAxisName(when)}
          tick={{ fill: 'var(--theme-grey)' }}
        />
        <YAxis tickFormatter={abbrNum} tick={{ fill: 'var(--theme-grey)' }} />
        <Tooltip labelFormatter={dateFormatter(when)} contentStyle={{ color: 'var(--theme-color)', backgroundColor: 'var(--theme-body)' }} />
        <Legend />
        {Object.keys(data[0]).filter(v => v !== 'time' && v !== '__typename').map((v, i) =>
          <Area key={v} type='monotone' dataKey={v} name={v} stackId='1' stroke={COLORS[i]} fill={COLORS[i]} />)}
      </AreaChart>
    </ResponsiveContainer>
  )
}

function GrowthLineChart ({ data }) {
  const router = useRouter()
  if (!data || data.length === 0) {
    return null
  }
  // transform data into expected shape
  data = transformData(data)
  // need to grab when
  const when = router.query.when

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
          dataKey='time' tickFormatter={dateFormatter(when)} name={xAxisName(when)}
          tick={{ fill: 'var(--theme-grey)' }}
        />
        <YAxis tickFormatter={abbrNum} tick={{ fill: 'var(--theme-grey)' }} />
        <Tooltip labelFormatter={dateFormatter(when)} contentStyle={{ color: 'var(--theme-color)', backgroundColor: 'var(--theme-body)' }} />
        <Legend />
        {Object.keys(data[0]).filter(v => v !== 'time' && v !== '__typename').map((v, i) =>
          <Line key={v} type='monotone' dataKey={v} name={v} stroke={COLORS[i]} fill={COLORS[i]} />)}
      </LineChart>
    </ResponsiveContainer>
  )
}
