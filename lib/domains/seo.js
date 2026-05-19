import removeMd from 'remove-markdown'
import { MAX_SEO_TAGLINE_LENGTH } from '@/lib/constants'
import { truncateString } from '@/lib/format'

export function truncateDesc (desc, maxLength = MAX_SEO_TAGLINE_LENGTH) {
  if (!desc) return null
  return truncateString(removeMd(desc), maxLength)
}

// reads SEO columns off a domain mapping's SubBranding row and fills in
// territory-level defaults (sub name as title, sub description as tagline)
// when a column is unset.
export function getSeoWithFallback ({ subBranding, subName, subDesc }) {
  return {
    title: subBranding?.title ?? (subName ? `~${subName}` : null),
    tagline: subBranding?.tagline ?? (subDesc ? truncateDesc(subDesc) : null),
    faviconId: subBranding?.faviconId ?? null
  }
}
