import Layout from '../components/layout'
import Items from '../components/items'
import { ITEM_FIELDS } from '../fragments/items'
import { gql } from '@apollo/client'
import ApolloClient from '../api/client'
import UserHeader from '../components/user-header'

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
  const query = gql`
    ${ITEM_FIELDS}
    {
      items: userItems(userId: ${user.id}) {
        ...ItemFields
      }
    }
  `
  return (
    <Layout>
      <UserHeader user={user} />
      <Items query={query} />
    </Layout>
  )
}
