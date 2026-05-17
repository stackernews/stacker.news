import removeMd from 'remove-markdown'
import { MAX_SEO_TAGLINE_LENGTH } from '@/lib/constants'
import { truncateString } from '@/lib/format'

export function truncateDesc (desc, maxLength = MAX_SEO_TAGLINE_LENGTH) {
  if (!desc) return null
  return truncateString(removeMd(desc), maxLength)
}

export function getSeoWithFallback ({ subSeo, subName, subDesc }) {
  return {
    title: subSeo?.title ?? (subName ? `~${subName}` : null),
    tagline: subSeo?.tagline ?? (subDesc ? truncateDesc(subDesc) : null),
    faviconId: subSeo?.faviconId ?? null
  }
}
