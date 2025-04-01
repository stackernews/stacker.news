import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import removeMd from 'remove-markdown'
import { numWithUnits } from '@/lib/format'
import { useDomain } from '@/components/territory-domains'

export function SeoSearch ({ sub }) {
  const router = useRouter()
  const { customDomain: { domain, branding } } = useDomain()
  const title = branding?.title || 'stacker news'
  const subStr = sub && !domain ? ` ~${sub}` : ''
  const snStr = `${router.query.q || 'search'} \\ ${title}${subStr}`
  const desc = `SN${subStr} search: ${router.query.q || ''}`

  return (
    <NextSeo
      title={snStr}
      description={desc}
      openGraph={{
        snStr,
        description: desc,
        images: [
          {
            url: 'https://capture.stacker.news' + router.asPath
          }
        ],
        site_name: title
      }}
      twitter={{
        site: '@stacker_news',
        cardType: 'summary_large_image'
      }}
    />
  )
}

// for a sub we need
// item seo
// index page seo
// recent page seo
// TODO CUSTOM DOMAINS: cleanup, verify everything is good, apply custom title to everything

export default function Seo ({ sub, item, user }) {
  const router = useRouter()
  const { customDomain: { domain, branding } } = useDomain()
  const title = branding?.title || 'stacker news'
  const pathNoQuery = router.asPath.split('?')[0]
  const defaultTitle = pathNoQuery.slice(1)
  const snStr = `${title}${sub && !domain ? ` ~${sub}` : ''}`
  let fullTitle = `${defaultTitle && `${defaultTitle} \\ `}${title}`
  let desc = "It's like Hacker News but we pay you Bitcoin."
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
        site_name: title
      }}
      twitter={{
        site: '@stacker_news',
        cardType: 'summary_large_image'
      }}
    />
  )
}
