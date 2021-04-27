import Layout from '../../components/layout'
import { CommentsQuery } from '../../components/comments'
import { COMMENT_FIELDS } from '../../fragments/comments'
import { gql } from '@apollo/client'
import ApolloClient from '../../api/client'
import UserHeader from '../../components/user-header'

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
      <CommentsQuery query={query} includeParent noReply />
    </Layout>
  )
}
