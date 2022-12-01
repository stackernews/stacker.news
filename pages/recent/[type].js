import Layout from '../../components/layout'
import Items from '../../components/items'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { ITEMS } from '../../fragments/items'
import RecentHeader from '../../components/recent-header'
import { useRouter } from 'next/router'

const variables = { sort: 'recent' }
export const getServerSideProps = getGetServerSideProps(ITEMS, variables)

export default function Index ({ data: { items: { items, cursor } } }) {
  const router = useRouter()
  return (
    <Layout>
      <RecentHeader />
      <Items
        items={items} cursor={cursor}
        variables={{ ...variables, type: router.query.type }} rank
      />
    </Layout>
  )
}
