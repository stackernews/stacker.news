import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import removeMd from 'remove-markdown'
import { numWithUnits } from '@/lib/format'
import { useBranding } from './territory-branding'

// Resolves the brand/site-name/tagline triple for SEO meta:
// - on a custom domain those come from the territory's branding (with sub-name fallbacks)
// - on stacker news those fall back to the SN defaults.
function useSiteSeo () {
  const branding = useBranding()

  const brand = branding?.title ?? 'stacker news'
  const siteName = branding?.title ?? 'Stacker News'
  const tagline = branding?.tagline ?? 'moderating forums with money'

  // territory branding doesn't carry a twitter handle, so suppress @site on custom domains
  const twitter = branding
    ? { cardType: 'summary_large_image' }
    : { site: '@stacker_news', cardType: 'summary_large_image' }

  return { branding, brand, siteName, tagline, twitter }
}

export function SeoSearch ({ sub }) {
  const router = useRouter()
  const { branding, brand, siteName, twitter } = useSiteSeo()

  const subStr = !branding && sub ? ` ~${sub}` : ''
  const query = router.query.q || ''
  const title = `${query || 'search'} \\ ${brand}${subStr}`
  const desc = branding
    ? `${brand} search: ${query}`
    : `SN${subStr} search: ${query}`

  return (
    <NextSeo
      title={title}
      description={desc}
      openGraph={{
        title,
        description: desc,
        images: [
          {
            url: 'https://capture.stacker.news' + router.asPath
          }
        ],
        site_name: siteName
      }}
      twitter={twitter}
    />
  )
}

// for a sub we need
// item seo
// index page seo
// recent page seo

export default function Seo ({ sub, item, user }) {
  const router = useRouter()
  const pathNoQuery = router.asPath.split('?')[0]
  const { branding, brand, siteName, tagline, twitter } = useSiteSeo()

  const defaultTitle = pathNoQuery.slice(1)
  const snStr = `${brand}${!branding && sub ? ` ~${sub}` : ''}`

  let fullTitle = `${defaultTitle && `${defaultTitle} \\ `}${brand}`
  let desc = tagline

  if (item) {
    if (item.title) {
      fullTitle = `${item.title} \\ ${snStr}`
    } else if (item.root) {
      fullTitle = `reply on: ${item.root.title} \\ ${snStr}`
    }
    // at least for now subs (ie the only one is jobs) will always have text
    if (item.text) {
      desc = removeMd(item.text)
      if (desc) {
        desc = desc.replace(/\s+/g, ' ')
      }
    } else {
      desc = `@${item.user.name} stacked ${numWithUnits(item.sats)} ${item.url ? `posting ${item.url}` : 'with this discussion'}`
    }
    if (item.ncomments) {
      desc += ` [${numWithUnits(item.ncomments, { unitSingular: 'comment', unitPlural: 'comments' })}`
      if (item.boost) {
        desc += `, ${item.boost} boost`
      }
      desc += ']'
    } else if (item.boost) {
      desc += ` [${item.boost} boost]`
    }
  }
  if (user) {
    desc = `@${user.name} has [${user.optional.stacked ? `${user.optional.stacked} stacked,` : ''}${numWithUnits(user.nitems, { unitSingular: 'item', unitPlural: 'items' })}]`
  }

  return (
    <NextSeo
      title={fullTitle}
      description={desc}
      openGraph={{
        title: fullTitle,
        description: desc,
        images: [
          {
            url: 'https://capture.stacker.news' + pathNoQuery
          }
        ],
        site_name: siteName
      }}
      twitter={twitter}
    />
  )
}
