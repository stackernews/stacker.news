import { ResponsiveSankey } from '@nivo/sankey'
import { RotatingSankeyLabels } from './label'
import { formatSankeyValue, getSankeyData } from './data'

export function PayInSankey ({ payIn }) {
  const data = getSankeyData(payIn)
  return (
    <div className='position-relative' style={{ width: '100%', maxWidth: '600px', height: '460px' }}>
      <ResponsiveSankey
        data={data}
        margin={{ top: 60, right: 60, bottom: 160, left: 60 }}
        align='justify'
        labelPosition='outside'
        labelTextColor={{ from: 'color', modifiers: [['brighter', 0.8]] }}
        colors={{ scheme: 'category10' }}
        nodeBorderColor={{ from: 'color', modifiers: [['darker', 0.8]] }}
        labelOrientation='horizontal'
        linkBlendMode='normal'
        defaultHeight={240}
        defaultWidth={480}
        animate={false}
        linkOpacity={0.5}
        linkHoverOpacity={0.65}
        linkHoverOthersOpacity={0.5}
        labelPadding={16}
        layout='vertical'
        linkContract={3}
        nodeHoverOthersOpacity={0.5}
        labelComponent={RotatingSankeyLabels}
        nodeTooltip={Tooltip}
        linkTooltip={Tooltip}
        valueFormat={formatSankeyValue}
        nodeSpacing={24}
      />
    </div>
  )
}

export function PayInSankeySkeleton () {
  return (
    <div style={{ width: '100%', maxWidth: '600px', height: '360px' }} className='clouds' />
  )
}

function Tooltip ({ node, link }) {
  node ??= link
  if (!node.asset) {
    return null
  }
  return <div style={{ whiteSpace: 'nowrap', backgroundColor: 'var(--bs-body-bg)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--bs-border-color)' }}>{node.asset}</div>
}
