import { msatsToSatsDecimal, numWithUnits } from '@/lib/format'
import { ResponsiveSankey, SankeyLabelComponent } from '@nivo/sankey'

export function PayInSankey ({ payIn }) {
  const data = getSankeyData(payIn)
  return (
    <div className='position-relative' style={{ width: '100%', maxWidth: '600px', height: '300px' }}>
      <ResponsiveSankey
        data={data}
        margin={{ top: 30, right: 30, bottom: 30, left: 30 }}
        align='justify'
        labelPosition='outside'
        labelTextColor={{ from: 'color', modifiers: [['brighter', 0.8]] }}
        colors={{ scheme: 'category10' }}
        nodeBorderColor={{ from: 'color', modifiers: [['darker', 0.8]] }}
        labelOrientation='horizontal'
        linkBlendMode='normal'
        defaultHeight={300}
        defaultWidth={500}
        animate={false}
        linkOpacity={0.5}
        linkHoverOpacity={0.65}
        linkHoverOthersOpacity={0.5}
        labelPadding={16}
        layout='vertical'
        linkContract={3}
        nodeHoverOthersOpacity={0.5}
        labelComponent={SankeyLabelComponent}
        nodeTooltip={Tooltip}
        linkTooltip={Tooltip}
        nodeSpacing={24}
      />
    </div>
  )
}

export function PayInSankeySkeleton () {
  return (
    <div style={{ width: '100%', maxWidth: '600px', height: '300px' }} className='clouds' />
  )
}

function assetFormatted (msats, type) {
  if (type === 'CREDITS') {
    return numWithUnits(msatsToSatsDecimal(msats), { unitSingular: 'CC', unitPlural: 'CCs', abbreviate: false })
  }
  return numWithUnits(msatsToSatsDecimal(msats), { unitSingular: 'sat', unitPlural: 'sats', abbreviate: false })
}

function Tooltip ({ node, link }) {
  node ??= link
  if (!node.asset) {
    return null
  }
  return <div style={{ whiteSpace: 'nowrap', backgroundColor: 'var(--bs-body-bg)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--bs-border-color)' }}>{node.asset}</div>
}

function getSankeyData (payIn) {
  const nodes = []
  const links = []

  // stacker news is always a node
  nodes.push({
    id: ''
  })

  // Create individual nodes for each payInCustodialToken
  if (payIn.payInCustodialTokens && payIn.payInCustodialTokens.length > 0) {
    payIn.payInCustodialTokens.forEach((token, index) => {
      const id = token.custodialTokenType === 'SATS' ? 'sats' : 'CCs'
      nodes.push({
        id,
        mtokens: token.mtokens,
        custodialTokenType: token.custodialTokenType
      })
      links.push({
        source: id,
        target: '',
        mtokens: token.mtokens,
        custodialTokenType: token.custodialTokenType
      })
    })
  }

  // Create node for payInBolt11 if it exists
  if (payIn.payInBolt11) {
    nodes.push({
      id: 'lightning',
      mtokens: payIn.payInBolt11.msatsRequested,
      custodialTokenType: 'SATS'
    })

    let leftOverMsats = payIn.payInBolt11.msatsRequested

    // this is a p2p zap or payment
    if (payIn.payOutBolt11) {
      leftOverMsats = payIn.payInBolt11.msatsRequested - payIn.payOutBolt11.msats
      let id = 'lightning (out)'
      if (payIn.payOutBolt11) {
        if (payIn.payOutBolt11.user?.name) {
          id = `@${payIn.payOutBolt11.user.name}`
        }

        nodes.push({
          id,
          mtokens: payIn.payOutBolt11.msats,
          custodialTokenType: 'SATS'
        })

        links.push({
          source: 'lightning',
          target: id,
          mtokens: payIn.payOutBolt11.msats,
          custodialTokenType: 'SATS'
        })
      }
    }

    if (leftOverMsats > 0) {
      links.push({
        source: 'lightning',
        target: '',
        mtokens: leftOverMsats,
        custodialTokenType: 'SATS'
      })
    }
  } else if (payIn.payOutBolt11) {
    // this is a withdrawal
    nodes.push({
      id: 'lightning (out)',
      mtokens: payIn.payOutBolt11.msats,
      custodialTokenType: 'SATS'
    })

    links.push({
      source: '',
      target: 'lightning (out)',
      mtokens: payIn.payOutBolt11.msats,
      custodialTokenType: 'SATS'
    })
  }

  // Create individual nodes for each payOutCustodialToken
  if (payIn.payOutCustodialTokens && payIn.payOutCustodialTokens.length > 0) {
    payIn.payOutCustodialTokens.forEach((token, index) => {
      let id = token.payOutType.toLowerCase().replace('_', ' ')
      if (token.payOutType === 'TERRITORY_REVENUE' && token.sub?.name) {
        id = `~${token.sub.name}`
      } else if (token.payOutType === 'ZAP' && token.user?.name) {
        id = `@${token.user.name}`
      } else if (token.payOutType === 'ROUTING_FEE') {
        id = 'route'
      } else if (token.payOutType === 'ROUTING_FEE_REFUND') {
        id = 'refund'
      } else if (token.payOutType === 'REWARDS_POOL') {
        id = 'rewards'
      }

      nodes.push({
        id,
        mtokens: token.mtokens,
        custodialTokenType: token.custodialTokenType
      })
      links.push({
        source: '',
        target: id,
        mtokens: token.mtokens,
        custodialTokenType: token.custodialTokenType
      })
    })
  }

  return reduceLinksAndNodes({ nodes, links })
}

// combine duplicate nodes and links, adding the mtokens together
function reduceLinksAndNodes ({ links, nodes }) {
  const reducedLinks = []
  const reducedNodes = []

  nodes.forEach(node => {
    const existingNode = reducedNodes.find(n => n.id === node.id)
    if (existingNode) {
      existingNode.mtokens += node.mtokens
    } else {
      reducedNodes.push(node)
    }
  })

  reducedNodes.forEach(node => {
    if (node.mtokens) {
      node.asset = assetFormatted(node.mtokens, node.custodialTokenType)
    }
  })

  links.forEach(link => {
    const existingLink = reducedLinks.find(l => l.source === link.source && l.target === link.target)
    if (existingLink) {
      existingLink.mtokens += link.mtokens
    } else {
      reducedLinks.push(link)
    }
  })

  reducedLinks.forEach(link => {
    link.value = msatsToSatsDecimal(link.mtokens)
    link.asset = assetFormatted(link.mtokens, link.custodialTokenType)
  })

  return { links: reducedLinks, nodes: reducedNodes }
}
