import Layout from '../../components/layout'
import { useQuery } from '@apollo/client'
import UserHeader from '../../components/user-header'
import CommentsFlat from '../../components/comments-flat'
import Seo from '../../components/seo'
import { USER_FULL } from '../../fragments/users'
import { useRouter } from 'next/router'
import { MORE_FLAT_COMMENTS } from '../../fragments/comments'
import { getServerSideProps as headerProps } from './index'
import getSSRApolloClient from '../../api/ssrApollo'

export async function getServerSideProps ({ req, params: { username } }) {
  const { notFound, props } = await headerProps({ req, params: { username } })

  if (notFound) {
    return {
      notFound
    }
  }

  const { user } = props
  const client = await getSSRApolloClient(req)
  const { data } = await client.query({
    query: MORE_FLAT_COMMENTS,
    variables: { userId: user.id }
  })

  let comments, cursor
  if (data) {
    ({ moreFlatComments: { comments, cursor } } = data)
  }

  return {
    props: {
      ...props,
      comments,
      cursor
    }
  }
}

export default function UserComments ({ user, comments, cursor }) {
  const router = useRouter()

  const { data } = useQuery(
    USER_FULL(user.name), {
      fetchPolicy: router.query.cache ? 'cache-first' : undefined
    })

  if (data) {
    ({ user } = data)
  }

  return (
    <Layout noSeo>
      <Seo user={user} />
      <UserHeader user={user} />
      <CommentsFlat
        comments={comments} cursor={cursor}
        variables={{ userId: user.id }} includeParent noReply
      />
    </Layout>
  )
}
