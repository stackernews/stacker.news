import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import removeMd from 'remove-markdown'

export function SeoSearch ({ sub }) {
  const router = useRouter()
  const subStr = sub ? ` ~${sub}` : ''
  const title = `${router.query.q || 'search'} \\ stacker news${subStr}`
  const desc = `SN${subStr} search: ${router.query.q || ''}`

  return (
    <NextSeo
      title={title}
      description={desc}
      openGraph={{
        title,
        description: desc,
        images: [
          {
            url: 'https://stacker.news/api/capture' + router.asPath
          }
        ],
        site_name: 'Stacker News'
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

export default function Seo ({ sub, item, user }) {
  const router = useRouter()
  const pathNoQuery = router.asPath.split('?')[0]
  const defaultTitle = pathNoQuery.slice(1)
  const snStr = `stacker news${sub ? ` ~${sub}` : ''}`
  let fullTitle = `${defaultTitle && `${defaultTitle} \\ `}stacker news`
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
      desc = `@${item.user.name} stacked ${item.sats} sats ${item.url ? `posting ${item.url}` : 'with this discussion'}`
    }
    if (item.ncomments) {
      desc += ` [${item.ncomments} comments`
      if (item.boost) {
        desc += `, ${item.boost} boost`
      }
      desc += ']'
    } else if (item.boost) {
      desc += ` [${item.boost} boost]`
    }
  }
  if (user) {
    desc = `@${user.name} has [${user.stacked} stacked, ${user.nposts} posts, ${user.ncomments} comments]`
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
            url: 'https://stacker.news/api/capture' + pathNoQuery
          }
        ],
        site_name: 'Stacker News'
      }}
      twitter={{
        site: '@stacker_news',
        cardType: 'summary_large_image'
      }}
    />
  )
}
