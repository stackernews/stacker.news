
import ApolloClient from '../api/client'
import { gql } from '@apollo/client'
import generateRssFeed from '../lib/rss'

export default function RssFeed () {
  return null
}

export async function getServerSideProps({ req, res }) {
  const emptyProps = { props: {} } // to avoid server side warnings
  const { error, data } = await (await ApolloClient(req)).query({
    query: gql`
      query Items {
        items {
          createdAt
          id
          title
        }
      }
    `,
  })

  if (!data.items || error) return emptyProps

  res.setHeader("Content-Type", "text/xml")
  res.write(generateRssFeed(data.items))
  res.end()

  return emptyProps
}
