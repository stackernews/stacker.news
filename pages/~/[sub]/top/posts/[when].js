import Layout from '../../../../../components/layout'
import Items from '../../../../../components/items'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../../../../api/ssrApollo'
import TopHeader from '../../../../../components/top-header'
import { SUB_TOP_ITEMS } from '../../../../../fragments/subs'

export const getServerSideProps = getGetServerSideProps(SUB_TOP_ITEMS, undefined,
  data => !data.sub)

export default function Index ({ data: { sub, topItems: { items, cursor } } }) {
  const router = useRouter()

  return (
    <Layout sub={sub?.name}>
      <TopHeader sub={sub?.name} cat='posts' />
      <Items
        items={items} cursor={cursor}
        query={SUB_TOP_ITEMS}
        destructureData={data => data.topItems}
        variables={{ sub: sub?.name, sort: router.query.sort, when: router.query.when }} rank
      />
    </Layout>
  )
}
