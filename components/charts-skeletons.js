export function GrowthPieChartSkeleton ({ width = '100%', height = '250px !important', minWidth = '200px' }) {
  return <ChartSkeleton {...{ width, height, minWidth }} />
}

export function WhenComposedChartSkeleton ({ width = '100%', height = '300px !important', minWidth = '300px' }) {
  return <ChartSkeleton {...{ width, height, minWidth }} />
}

export function WhenAreaChartSkeleton ({ width = '100%', height = '300px !important', minWidth = '300px' }) {
  return <ChartSkeleton {...{ width, height, minWidth }} />
}

export function WhenLineChartSkeleton ({ width = '100%', height = '300px !important', minWidth = '300px' }) {
  return <ChartSkeleton {...{ width, height, minWidth }} />
}

function ChartSkeleton (props) {
  return <div className='h-auto mx-auto w-100 clouds' style={{ ...props }} />
}
