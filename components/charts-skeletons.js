export function GrowthPieChartSkeleton ({ height = '250px', minWidth = '200px' }) {
  return <ChartSkeleton {...{ height, minWidth }} />
}

export function WhenComposedChartSkeleton ({ height = '300px', minWidth = '300px' }) {
  return <ChartSkeleton {...{ height, minWidth }} />
}

export function WhenAreaChartSkeleton ({ height = '300px', minWidth = '300px' }) {
  return <ChartSkeleton {...{ height, minWidth }} />
}

export function WhenLineChartSkeleton ({ height = '300px', minWidth = '300px' }) {
  return <ChartSkeleton {...{ height, minWidth }} />
}

function ChartSkeleton (props) {
  return <div className='mx-auto w-100 clouds' style={{ ...props }} />
}
