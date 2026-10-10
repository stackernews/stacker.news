export function GrowthPieChartSkeleton ({ height = '250px', minWidth = '200px' }) {
  return <ChartSkeleton {...{ height, width: '100%' }} />
}

export function WhenComposedChartSkeleton ({ height = '300px', minWidth = '300px' }) {
  return <ChartSkeleton {...{ height, width: '100%' }} />
}

export function WhenAreaChartSkeleton ({ height = '300px', minWidth = '300px' }) {
  return <ChartSkeleton {...{ height, width: '100%' }} />
}

export function WhenLineChartSkeleton ({ height = '300px', minWidth = '300px' }) {
  return <ChartSkeleton {...{ height, width: '100%' }} />
}

function ChartSkeleton (props) {
  return <div className='mx-auto w-100 clouds' style={{ ...props }} />
}
