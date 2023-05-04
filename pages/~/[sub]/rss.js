
import getGetRssServerSideProps from '../../../lib/rss'
import { ITEMS } from '../../../fragments/items'

export default function RssFeed () {
  return null
}

export const getServerSideProps = ({ req, res, params }) => getGetRssServerSideProps(ITEMS, { sub: params.sub })({ req, res });
