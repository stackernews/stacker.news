import removeMd from 'remove-markdown'
import { numWithUnits } from './format'

export function cleanMarkdownText (text) {
  if (!text) return ''

  let cleaned = removeMd(text)
  cleaned = cleaned
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    // Handle nested markdown links like [[text]](url) - remove outer brackets and keep inner text
    .replace(/\[\[([^\]]+)\]\]\([^)]+\)/g, '$1') // Remove nested markdown links, keep inner text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove regular markdown links, keep text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images completely
    .replace(/`([^`]+)`/g, '$1') // Remove code formatting
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
    .trim()

  return cleaned
}

export function truncateAtSentenceBoundary (text, maxLength = 160) {
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

export function processDescription (text, options = {}) {
  const { minLength = 30, maxLength = 160, fallback = null } = options

  if (!text) return fallback

  const processed = cleanMarkdownText(text)

  if (processed.length >= minLength && processed.length <= maxLength) {
    return processed
  }

  if (processed.length > maxLength) {
    return truncateAtSentenceBoundary(processed, maxLength)
  }

  return fallback
}

export function processItemSEODescription (item) {
  if (item.text) {
    const processed = processDescription(item.text, {
      minLength: 30,
      maxLength: 160,
      fallback: generateItemDescription(item)
    })

    if (processed) return processed
  }

  return generateItemDescription(item)
}

function generateItemDescription (item) {
  const parts = []

  if (item.user?.name) {
    parts.push(`@${item.user.name}`)
  }

  if (item.sats > 0) {
    parts.push(`stacked ${numWithUnits(item.sats)}`)
  }

  if (item.url) {
    parts.push(`posting ${item.url}`)
  } else {
    parts.push('with this discussion')
  }

  if (item.ncomments) {
    parts.push(`${numWithUnits(item.ncomments, { unitSingular: 'comment', unitPlural: 'comments' })})`)
  }

  if (item.boost) {
    parts.push(`${item.boost} boost`)
  }

  return parts.join(' ')
}

export function processUserSEODescription (user) {
  if (user.bio?.text) {
    const processed = processDescription(user.bio.text, {
      minLength: 30,
      maxLength: 160,
      fallback: generateUserDescription(user)
    })

    if (processed) return processed
  }

  return generateUserDescription(user)
}

function generateUserDescription (user) {
  const parts = []

  if (user.optional?.stacked) {
    parts.push(`${user.optional.stacked} stacked`)
  }

  if (user.nitems) {
    parts.push(`${numWithUnits(user.nitems, { unitSingular: 'item', unitPlural: 'items' })})`)
  }

  if (parts.length > 0) {
    return `@${user.name} has [${parts.join(', ')}]`
  }

  return `@${user.name}`
}

export function processTerritorySEODescription (territory) {
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

function generateTerritoryDescription (territory) {
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
