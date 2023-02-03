import Layout from '../../../components/layout'
import Items from '../../../components/items'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import { TOP_ITEMS } from '../../../fragments/items'
import TopHeader from '../../../components/top-header'

export const getServerSideProps = getGetServerSideProps(TOP_ITEMS)

export default function Index ({ data: { topItems: { items, cursor } } }) {
  const router = useRouter()

  return (
    <Layout>
      <TopHeader cat='posts' />
      <Items
        items={items} cursor={cursor}
        query={TOP_ITEMS}
        destructureData={data => data.topItems}
        variables={{ sort: router.query.sort, when: router.query.when }} rank
      />
    </Layout>
  )
}
