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
import { abbrNum } from '../lib/format'
import { useRouter } from 'next/router'

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

const COLORS = [
  'var(--bs-secondary)',
  'var(--bs-info)',
  'var(--bs-success)',
  'var(--bs-boost)',
  'var(--theme-grey)',
  'var(--bs-danger)'
]

export function WhenAreaChart ({ data }) {
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
        <Tooltip labelFormatter={dateFormatter(when)} contentStyle={{ color: 'var(--bs-body-color)', backgroundColor: 'var(--bs-body-bg)' }} />
        <Legend />
        {Object.keys(data[0]).filter(v => v !== 'time' && v !== '__typename').map((v, i) =>
          <Area key={v} type='monotone' dataKey={v} name={v} stackId='1' stroke={COLORS[i]} fill={COLORS[i]} />)}
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
        <Tooltip labelFormatter={dateFormatter(when)} contentStyle={{ color: 'var(--bs-body-color)', backgroundColor: 'var(--bs-body-bg)' }} />
        <Legend />
        {Object.keys(data[0]).filter(v => v !== 'time' && v !== '__typename').map((v, i) =>
          <Line key={v} type='monotone' dataKey={v} name={v} stroke={COLORS[i]} fill={COLORS[i]} />)}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function WhenComposedChart ({
  data,
  lineNames = [], lineAxis = 'left',
  areaNames = [], areaAxis = 'left',
  barNames = [], barAxis = 'left'
}) {
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
          dataKey='time' tickFormatter={dateFormatter(when)} name={xAxisName(when)}
          tick={{ fill: 'var(--theme-grey)' }}
        />
        <YAxis yAxisId='left' orientation='left' allowDecimals={false} stroke='var(--theme-grey)' tickFormatter={abbrNum} tick={{ fill: 'var(--theme-grey)' }} />
        <YAxis yAxisId='right' orientation='right' allowDecimals={false} stroke='var(--theme-grey)' tickFormatter={abbrNum} tick={{ fill: 'var(--theme-grey)' }} />
        <Tooltip labelFormatter={dateFormatter(when)} contentStyle={{ color: 'var(--bs-body-color)', backgroundColor: 'var(--bs-body-bg)' }} />
        <Legend />
        {barNames?.map((v, i) =>
          <Bar yAxisId={barAxis} key={v} type='monotone' dataKey={v} name={v} stroke='var(--bs-info)' fill='var(--bs-info)' />)}
        {areaNames?.map((v, i) =>
          <Area yAxisId={areaAxis} key={v} type='monotone' dataKey={v} name={v} stackId='1' stroke={COLORS[i]} fill={COLORS[i]} />)}
        {lineNames?.map((v, i) =>
          <Line yAxisId={lineAxis} key={v} type='monotone' dataKey={v} name={v} stackId='1' stroke={COLORS[areaNames.length + i]} />)}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function GrowthPieChart ({ data }) {
  const nonZeroData = data.filter(d => d.value > 0)

  return (
    <ResponsiveContainer width='100%' height={250} minWidth={200}>
      <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
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
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))
          }
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}
