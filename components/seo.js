import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import RemoveMarkdown from 'remove-markdown'

export default function Seo ({ item, user }) {
  const router = useRouter()
  const pathNoQuery = router.asPath.split('?')[0]
  const defaultTitle = pathNoQuery.slice(1)
  let fullTitle = `${defaultTitle && `${defaultTitle} \\ `}stacker news`
  let desc = "It's like Hacker News but we pay you Bitcoin."
  if (item) {
    if (item.title) {
      fullTitle = `${item.title} \\ stacker news`
    } else if (item.root) {
      fullTitle = `reply on: ${item.root.title} \\ stacker news`
    }
    if (item.text) {
      desc = RemoveMarkdown(item.text)
      if (desc) {
        desc = desc.replace(/\s+/g, ' ')
      }
    } else {
      desc = `@${item.user.name} stacked ${(item.sats > 0 ? item.sats - 1 : 0) + item.tips} sats ${item.url ? `posting ${item.url}` : 'with this discussion'}`
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
    desc = `@${user.name} has [${user.stacked} stacked, ${user.nitems} posts, ${user.ncomments} comments]`
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
