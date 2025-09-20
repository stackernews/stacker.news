import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import { processTerritorySEODescription, processItemSEODescription, processUserSEODescription } from '@/lib/seo'

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
            url: 'https://capture.stacker.news' + router.asPath
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

export default function Seo ({ sub, item, user, territory }) {
  const router = useRouter()
  const pathNoQuery = router.asPath.split('?')[0]
  const defaultTitle = pathNoQuery.slice(1)
  const snStr = `stacker news${sub ? ` ~${sub}` : ''}`
  let fullTitle = `${defaultTitle && `${defaultTitle} \\ `}stacker news`
  let desc = "It's like Hacker News but we pay you Bitcoin."
  if (territory) {
    fullTitle = `${territory.name} \\ ${snStr}`
    desc = processTerritorySEODescription(territory)
  } else if (item) {
    if (item.title) {
      fullTitle = `${item.title} \\ ${snStr}`
    } else if (item.root) {
      fullTitle = `reply on: ${item.root.title} \\ ${snStr}`
    }
    desc = processItemSEODescription(item)
  } else if (user) {
    desc = processUserSEODescription(user)
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
        site_name: 'Stacker News'
      }}
      twitter={{
        site: '@stacker_news',
        cardType: 'summary_large_image'
      }}
    />
  )
}
