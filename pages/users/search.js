import Layout from '../../components/layout'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { SeoSearch } from '../../components/seo'
import { USER_SEARCH } from '../../fragments/users'
import UserList from '../../components/user-list'

export const getServerSideProps = getGetServerSideProps(USER_SEARCH, { limit: 21, similarity: 0.2 })

export default function Index ({ data: { searchUsers } }) {
  return (
    <Layout noSeo>
      <SeoSearch />
      <UserList users={searchUsers} />
    </Layout>
  )
}
