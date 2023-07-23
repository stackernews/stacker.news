import Layout from '../../../../components/layout'
import Items from '../../../../components/items'
import { getGetServerSideProps } from '../../../../api/ssrApollo'
import RecentHeader from '../../../../components/recent-header'
import { useRouter } from 'next/router'
import { SUB_ITEMS } from '../../../../fragments/subs'

const variables = { sort: 'recent' }
export const getServerSideProps = getGetServerSideProps(SUB_ITEMS, variables, data => !data.sub)

export default function Index ({ data: { sub, items: { items, cursor } } }) {
  const router = useRouter()
  return (
    <Layout sub={sub?.name}>
      <RecentHeader sub={sub} />
      <Items
        items={items} cursor={cursor}
        variables={{ ...variables, sub: sub?.name, type: router.query.type }} rank
      />
    </Layout>
  )
}
