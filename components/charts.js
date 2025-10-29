import { LineChart } from 'recharts/lib/chart/LineChart'
import { AreaChart } from 'recharts/lib/chart/AreaChart'
import { ComposedChart } from 'recharts/lib/chart/ComposedChart'
import { Line } from 'recharts/lib/cartesian/Line'
import { XAxis } from 'recharts/lib/cartesian/XAxis'
import { YAxis } from 'recharts/lib/cartesian/YAxis'
import { Area } from 'recharts/lib/cartesian/Area'
import { Bar } from 'recharts/lib/cartesian/Bar'
import { Tooltip } from 'recharts/lib/component/Tooltip'
import { Legend } from 'recharts/lib/component/Legend'
import { ResponsiveContainer } from 'recharts/lib/component/ResponsiveContainer'
import { PieChart } from 'recharts/lib/chart/PieChart'
import { Cell } from 'recharts/lib/component/Cell'
import { Pie } from 'recharts/lib/polar/Pie'
import { abbrNum } from '@/lib/format'
import { useRouter } from 'next/router'
import { timeUnitForRange } from '@/lib/time'
import { payTypeShortName } from '@/lib/pay-in'

const dateFormatter = (when, from, to) => {
  const unit = xAxisName(when, from, to)
  return timeStr => {
    const date = new Date(timeStr)
    switch (unit) {
      case 'day':
      case 'week':
        return `${('0' + (date.getUTCMonth() % 12 + 1)).slice(-2)}/${date.getUTCDate()}`
      case 'month':
        return `${('0' + (date.getUTCMonth() % 12 + 1)).slice(-2)}/${String(date.getUTCFullYear()).slice(-2)}`
      default:
        return `${date.getHours() % 12 || 12}${date.getHours() >= 12 ? 'pm' : 'am'}`
    }
  }
}

const labelFormatter = (when, from, to) => {
  const unit = xAxisName(when, from, to)
  const dateFormat = dateFormatter(when, from, to)
  return timeStr => `${unit} ${dateFormat(timeStr)}`
}

function xAxisName (when, from, to) {
  if (from) {
    return timeUnitForRange([from, to])
  }
  switch (when) {
    case 'week':
    case 'month':
      return 'day'
    case 'year':
    case 'forever':
      return 'month'
    default:
      return 'hour'
  }
}

const transformData = data => {
  return data.map(entry => {
    const obj = { time: entry.time }
    entry.data.forEach(entry1 => {
      obj[payTypeShortName(entry1.name)] = entry1.value
    })
    return obj
  })
}

const COLORS = [
  'var(--bs-secondary)',
  'var(--bs-info)',
  'var(--bs-success)',
  'var(--bs-boost)',
  'var(--theme-grey)',
  'var(--bs-danger)',
  'var(--bs-code-color)'
]

function getColor (i) {
  return COLORS[i % COLORS.length]
}

export function WhenAreaChart ({ data }) {
  const router = useRouter()
  if (!data || data.length === 0) {
    return null
  }
  // transform data into expected shape
  data = transformData(data)
  // need to grab when
  const when = router.query.when
  const from = router.query.from
  const to = router.query.to

  return (
    <ResponsiveContainer width='100%' height={400} minWidth={300}>
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
          dataKey='time' tickFormatter={dateFormatter(when, from, to)} name={xAxisName(when, from, to)}
          tick={{ fill: 'var(--theme-grey)' }}
        />
        <YAxis tickFormatter={abbrNum} tick={{ fill: 'var(--theme-grey)' }} />
        <Tooltip labelFormatter={labelFormatter(when, from, to)} contentStyle={{ color: 'var(--bs-body-color)', backgroundColor: 'var(--bs-body-bg)', opacity: 1, zIndex: -1 }} />
        <Legend />
        {Object.keys(data[0]).filter(v => v !== 'time' && v !== '__typename').map((v, i) =>
          <Area key={v} type='monotone' dataKey={v} name={v} stackId='1' stroke={getColor(i)} fill={getColor(i)} />)}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function WhenLineChart ({ data }) {
  const router = useRouter()
  if (!data || data.length === 0) {
    return null
  }
  // transform data into expected shape
  data = transformData(data)
  // need to grab when
  const when = router.query.when
  const from = router.query.from
  const to = router.query.to

  return (
    <ResponsiveContainer width='100%' height={400} minWidth={300}>
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
          dataKey='time' tickFormatter={dateFormatter(when, from, to)} name={xAxisName(when, from, to)}
          tick={{ fill: 'var(--theme-grey)' }}
        />
        <YAxis tickFormatter={abbrNum} tick={{ fill: 'var(--theme-grey)' }} />
        <Tooltip labelFormatter={labelFormatter(when, from, to)} contentStyle={{ color: 'var(--bs-body-color)', backgroundColor: 'var(--bs-body-bg)' }} />
        <Legend />
        {Object.keys(data[0]).filter(v => v !== 'time' && v !== '__typename').map((v, i) =>
          <Line key={v} type='monotone' dataKey={v} name={v} stroke={getColor(i)} fill={getColor(i)} />)}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function WhenComposedChart ({
  data,
  lineNames = [], lineAxis = 'left',
  areaNames = [], areaAxis = 'left',
  barNames = [], barAxis = 'left', barStackId
}) {
  const router = useRouter()
  if (!data || data.length === 0) {
    return null
  }
  // transform data into expected shape
  data = transformData(data)
  // need to grab when
  const when = router.query.when
  const from = router.query.from
  const to = router.query.to

  return (
    <ResponsiveContainer width='100%' height={400} minWidth={300}>
      <ComposedChart
        data={data}
        margin={{
          top: 5,
          right: 5,
          left: 0,
          bottom: 0
        }}
      >
        <XAxis
          dataKey='time' tickFormatter={dateFormatter(when, from, to)} name={xAxisName(when, from, to)}
          tick={{ fill: 'var(--theme-grey)' }}
        />
        <YAxis yAxisId='left' orientation='left' allowDecimals={false} stroke='var(--theme-grey)' tickFormatter={abbrNum} tick={{ fill: 'var(--theme-grey)' }} />
        <YAxis yAxisId='right' orientation='right' allowDecimals={false} stroke='var(--theme-grey)' tickFormatter={abbrNum} tick={{ fill: 'var(--theme-grey)' }} />
        <Tooltip labelFormatter={labelFormatter(when, from, to)} contentStyle={{ color: 'var(--bs-body-color)', backgroundColor: 'var(--bs-body-bg)' }} />
        <Legend />
        {barNames?.map((v, i) =>
          <Bar yAxisId={barAxis} key={v} stackId={barStackId} type='monotone' dataKey={v} name={v} stroke={getColor(i)} fill={getColor(i)} />)}
        {areaNames?.map((v, i) =>
          <Area yAxisId={areaAxis} key={v} type='monotone' dataKey={v} name={v} stackId='1' stroke={getColor(barNames.length + i)} fill={getColor(barNames.length + i)} />)}
        {lineNames?.map((v, i) =>
          <Line yAxisId={lineAxis} key={v} type='monotone' dataKey={v} name={v} stackId='1' stroke={getColor(barNames.length + areaNames.length + i)} />)}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function GrowthPieChart ({ data }) {
  const nonZeroData = data.filter(d => d.value > 0)

  return (
    <ResponsiveContainer width='100%' height={250} minWidth={250}>
      <PieChart margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <Pie
          dataKey='value'
          isAnimationActive={false}
          data={nonZeroData}
          cx='50%'
          cy='50%'
          minAngle={5}
          paddingAngle={0}
          outerRadius={80}
          fill='var(--bs-secondary)'
          label
        >
          {
            data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(index)} />
            ))
          }
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}
