import Layout from '../../components/layout'
import { getGetServerSideProps } from '../../api/ssrApollo'
import TopHeader from '../../components/top-header'
import { TOP_COWBOYS } from '../../fragments/users'
import { useQuery } from '@apollo/client'
import MoreFooter from '../../components/more-footer'
import UserList, { UsersSkeleton } from '../../components/user-list'

export const getServerSideProps = getGetServerSideProps(TOP_COWBOYS)

export default function Index ({ data: { topCowboys: { users, cursor } } }) {
  const { data, fetchMore } = useQuery(TOP_COWBOYS)

  if (data) {
    ({ topCowboys: { users, cursor } } = data)
  }

  return (
    <Layout>
      <TopHeader cat='cowboys' />
      <UserList users={users} />
      <MoreFooter cursor={cursor} fetchMore={fetchMore} Skeleton={UsersSkeleton} />
    </Layout>
  )
}
