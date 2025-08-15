import { TERRITORY_GRACE_DAYS, TERRITORY_PERIOD_COST } from './constants'
import { datePivot, diffDays } from './time'
import removeMd from 'remove-markdown'

export function nextBilling (relativeTo, billingType) {
  if (!relativeTo || billingType === 'ONCE') return null

  const pivot = billingType === 'MONTHLY'
    ? { months: 1 }
    : { years: 1 }

  return datePivot(new Date(relativeTo), pivot)
}

export function purchasedType (sub) {
  if (!sub?.billPaidUntil) return 'ONCE'
  return diffDays(new Date(sub.billedLastAt), new Date(sub.billPaidUntil)) >= 364 ? 'YEARLY' : 'MONTHLY'
}

export function proratedBillingCost (sub, newBillingType) {
  if (!sub ||
    sub.billingType === 'ONCE' ||
    sub.billingType === newBillingType.toUpperCase()) return 0

  return TERRITORY_PERIOD_COST(newBillingType) - TERRITORY_PERIOD_COST(purchasedType(sub))
}

export function nextBillingWithGrace (sub) {
  if (!sub) return null
  return datePivot(new Date(sub.billPaidUntil), { days: TERRITORY_GRACE_DAYS })
}

function cleanMarkdownText (text) {
  if (!text) return ''

  let cleaned = removeMd(text)
  cleaned = cleaned
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\[\[([^\]]+)\]\]\([^)]+\)/g, '$1') // Remove nested markdown links, keep inner text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove regular markdown links, keep text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images completely
    .replace(/`([^`]+)`/g, '$1') // Remove code formatting
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
    .trim()

  return cleaned
}

function truncateAtSentenceBoundary (text, maxLength = 160) {
  if (!text || text.length <= maxLength) return text
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(Boolean)

  let result = ''
  let currentLength = 0

  for (const sentence of sentences) {
    const separator = result ? '. ' : ''
    const newLength = currentLength + separator.length + sentence.length

    if (newLength <= maxLength - 3) {
      result += separator + sentence
      currentLength = newLength
    } else {
      break
    }
  }
  if (result) {
    return result + '...'
  }
  // Fallback to simple truncation
  return text.substring(0, maxLength - 3) + '...'
}

export function processTerritoryDescription (territory) {
  if (!territory) return null

  if (territory.desc) {
    const processedDesc = cleanMarkdownText(territory.desc)

    if (processedDesc.length >= 30 && processedDesc.length <= 160) {
      return processedDesc
    }
    if (processedDesc.length > 160) {
      return truncateAtSentenceBoundary(processedDesc, 160)
    }
  }

  // Generate a contextual description if the original is too short or unsuitable
  return generateTerritoryDescription(territory)
}

export function generateTerritoryDescription (territory) {
  const parts = []
  if (territory.desc) {
    const processedDesc = cleanMarkdownText(territory.desc)
    if (processedDesc) {
      parts.push(processedDesc)
    }
  }

  if (territory.postTypes && territory.postTypes.length > 0) {
    const postTypeLabels = territory.postTypes.map(type => {
      switch (type) {
        case 'LINK': return 'links'
        case 'DISCUSSION': return 'discussions'
        case 'BOUNTY': return 'bounties'
        case 'POLL': return 'polls'
        default: return type.toLowerCase()
      }
    })
    parts.push(postTypeLabels.join(', '))
  }

  if (territory.user?.name) {
    parts.push(`created by @${territory.user.name}`)
  }

  let desc = parts.length > 1
    ? `Stacker.news community: ${parts.join('. ')}`
    : `Stacker.news community for ${parts.join(', ')}`

  if (desc.length > 160) {
    desc = truncateAtSentenceBoundary(desc, 160)
  }

  return desc
}
