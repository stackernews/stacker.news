import Layout from '../../components/layout'
import Comments from '../../components/comments'
import { COMMENT_FIELDS } from '../../fragments/comments'
import { gql } from '@apollo/client'
import ApolloClient from '../../api/client'
import UserHeader from '../../components/user-header'

export async function getServerSideProps ({ params }) {
  const { error, data: { user } } = await ApolloClient.query({
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
    ${COMMENT_FIELDS}
    {
      comments: userComments(userId: ${user.id}) {
        ...CommentFields
      }
    }
  `
  return (
    <Layout>
      <UserHeader user={user} />
      <Comments query={query} includeParent noReply />
    </Layout>
  )
}
