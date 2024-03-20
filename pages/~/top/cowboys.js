import Layout from '@/components/layout'
import { getGetServerSideProps } from '@/api/ssrApollo'
import TopHeader from '@/components/top-header'
import { TOP_COWBOYS } from '@/fragments/users'
import UserList from '@/components/user-list'

export const getServerSideProps = getGetServerSideProps({ query: TOP_COWBOYS })

export default function Index ({ ssrData }) {
  return (
    <Layout>
      <TopHeader cat='cowboys' />
      <UserList
        ssrData={ssrData} query={TOP_COWBOYS}
        destructureData={data => data.topCowboys}
        rank
      />
    </Layout>
  )
}
