import { msatsToSatsDecimal, numWithUnits } from '@/lib/format'
import { payTypeShortName } from '@/lib/pay-in'

export function formatSankeyValue (value, locales) {
  return new Intl.NumberFormat(locales).format(value)
}

function msatsToSankeyValue (msats) {
  return Number(msatsToSatsDecimal(msats))
}

function assetFormatted (msats, type) {
  if (type === 'CREDITS') {
    return numWithUnits(msatsToSatsDecimal(msats), { unitSingular: 'CC', unitPlural: 'CCs', abbreviate: false })
  }
  return numWithUnits(msatsToSatsDecimal(msats), { unitSingular: 'sat', unitPlural: 'sats', abbreviate: false })
}

export function getSankeyData (payIn) {
  const nodes = []
  const links = []

  // stacker news is always a node
  nodes.push({
    id: ''
  })

  // Create individual nodes for each payInCustodialToken
  if (payIn.payerPrivates) {
    payIn.payerPrivates?.payInCustodialTokens?.forEach((token) => {
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
  } else if (!payIn.payInBolt11Public?.msats || payIn.mcost - payIn.payInBolt11Public.msats > 0) {
    const mtokens = payIn.mcost - (payIn.payInBolt11Public?.msats ?? 0)
    nodes.push({
      id: 'sats',
      mtokens,
      custodialTokenType: 'SATS'
    })
    links.push({
      source: 'sats',
      target: '',
      mtokens,
      custodialTokenType: 'SATS'
    })
  }

  // Create node for payInBolt11 if it exists
  if (payIn.payInBolt11Public) {
    nodes.push({
      id: 'lightning',
      mtokens: payIn.payInBolt11Public.msats,
      custodialTokenType: 'SATS'
    })

    let leftOverMsats = payIn.payInBolt11Public.msats

    // this is a p2p zap or payment
    if (payIn.payOutBolt11Public) {
      leftOverMsats = payIn.payInBolt11Public.msats - payIn.payOutBolt11Public.msats
      const id = 'lightning (out)'
      nodes.push({
        id,
        mtokens: payIn.payOutBolt11Public.msats,
        custodialTokenType: 'SATS'
      })

      links.push({
        source: 'lightning',
        target: id,
        mtokens: payIn.payOutBolt11Public.msats,
        custodialTokenType: 'SATS'
      })
    }

    if (leftOverMsats > 0) {
      links.push({
        source: 'lightning',
        target: '',
        mtokens: leftOverMsats,
        custodialTokenType: 'SATS'
      })
    }
  } else if (payIn.payOutBolt11Public) {
    // this is a withdrawal
    nodes.push({
      id: 'lightning (out)',
      mtokens: payIn.payOutBolt11Public.msats,
      custodialTokenType: 'SATS'
    })

    links.push({
      source: '',
      target: 'lightning (out)',
      mtokens: payIn.payOutBolt11Public.msats,
      custodialTokenType: 'SATS'
    })
  }

  // Create individual nodes for each payOutCustodialToken
  if (payIn.payOutCustodialTokens && payIn.payOutCustodialTokens.length > 0) {
    payIn.payOutCustodialTokens.forEach((token) => {
      let id = payTypeShortName(token.payOutType)
      if (['TERRITORY_REVENUE', 'DEFUNCT_DELAYED_TERRITORY_REVENUE'].includes(token.payOutType) && token.sub?.name) {
        id = `~${token.sub.name}`
      } else if (['ZAP', 'REWARD'].includes(token.payOutType) && token.sometimesPrivates?.user?.name) {
        // Only label payouts when the resolver exposed viewer-owned identity data.
        id = `@${token.sometimesPrivates.user.name}`
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
    link.value = msatsToSankeyValue(link.mtokens)
    link.asset = assetFormatted(link.mtokens, link.custodialTokenType)
  })

  return { links: reducedLinks, nodes: reducedNodes }
}
