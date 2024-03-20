import Layout from '@/components/layout'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '@/api/ssrApollo'
import TopHeader from '@/components/top-header'
import { TOP_SUBS } from '@/fragments/subs'
import TerritoryList from '@/components/territory-list'

export const getServerSideProps = getGetServerSideProps({ query: TOP_SUBS })

export default function Index ({ ssrData }) {
  const router = useRouter()
  const variables = { ...router.query }

  return (
    <Layout>
      <TopHeader cat='territories' />
      <TerritoryList
        ssrData={ssrData}
        query={TOP_SUBS}
        variables={variables}
        destructureData={data => data.topSubs}
        rank
      />
    </Layout>
  )
}
