import Layout from '@/components/layout'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '@/api/ssrApollo'
import TopHeader from '@/components/top-header'
import { TOP_USERS } from '@/fragments/users'
import UserList from '@/components/user-list'

export const getServerSideProps = getGetServerSideProps({ query: TOP_USERS })

export default function Index ({ ssrData }) {
  const router = useRouter()
  const variables = { ...router.query }

  return (
    <Layout>
      <TopHeader cat='stackers' />
      <UserList
        ssrData={ssrData} query={TOP_USERS}
        variables={variables} destructureData={data => data.topUsers}
        rank
      />
    </Layout>
  )
}
