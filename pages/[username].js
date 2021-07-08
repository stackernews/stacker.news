import Layout from '../components/layout'
import Items from '../components/items'
import { gql } from '@apollo/client'
import ApolloClient from '../api/client'
import UserHeader from '../components/user-header'
import Seo from '../components/seo'

export async function getServerSideProps ({ req, params }) {
  const { error, data: { user } } = await (await ApolloClient(req)).query({
    query:
      gql`{
        user(name: "${params.username}") {
          id
          createdAt
          name
          nitems
          ncomments
          stacked
          sats
        }
      }`
  })

  if (!user || error) {
    return {
      notFound: true
    }
  }

  return {
    props: {
      user
    }
  }
}

export default function User ({ user }) {
  return (
    <Layout noSeo>
      <Seo user={user} />
      <UserHeader user={user} />
      <Items variables={{ sort: 'user', userId: user.id }} />
    </Layout>
  )
}
