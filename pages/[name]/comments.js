import Layout from '../../components/layout'
import { useQuery } from '@apollo/client'
import UserHeader from '../../components/user-header'
import CommentsFlat from '../../components/comments-flat'
import Seo from '../../components/seo'
import { USER_WITH_COMMENTS } from '../../fragments/users'
import { getGetServerSideProps } from '../../api/ssrApollo'

export const getServerSideProps = getGetServerSideProps(USER_WITH_COMMENTS)

export default function UserComments (
  { data: { user, moreFlatComments: { comments, cursor } } }) {
  const { data } = useQuery(
    USER_WITH_COMMENTS, { variables: { name: user.name } })

  if (data) {
    ({ user, moreFlatComments: { comments, cursor } } = data)
  }

  return (
    <Layout noSeo>
      <Seo user={user} />
      <UserHeader user={user} />
      <CommentsFlat
        comments={comments} cursor={cursor}
        variables={{ name: user.name }} includeParent noReply
      />
    </Layout>
  )
}
