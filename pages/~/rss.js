import getGetRssServerSideProps from '@/lib/rss'
import { SUB_ITEMS } from '@/fragments/subs'

export default function RssFeed () {
  return null
}

export const getServerSideProps = getGetRssServerSideProps(SUB_ITEMS)
