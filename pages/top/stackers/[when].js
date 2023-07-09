import Layout from '../../../components/layout'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import TopHeader from '../../../components/top-header'
import { TOP_USERS } from '../../../fragments/users'
import { useQuery } from '@apollo/client'
import MoreFooter from '../../../components/more-footer'
import UserList, { UsersSkeleton } from '../../../components/user-list'

export const getServerSideProps = getGetServerSideProps(TOP_USERS)

export default function Index ({ data: { topUsers: { users, cursor } } }) {
  const router = useRouter()

  const { data, fetchMore } = useQuery(TOP_USERS, {
    variables: { when: router.query.when, sort: router.query.sort }
  })

  if (data) {
    ({ topUsers: { users, cursor } } = data)
  }

  return (
    <Layout>
      <TopHeader cat='stackers' />
      <UserList users={users} />
      <MoreFooter cursor={cursor} fetchMore={fetchMore} Skeleton={UsersSkeleton} />
    </Layout>
  )
}
