import Layout from '../../../components/layout'
import Items from '../../../components/items'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import { ITEMS } from '../../../fragments/items'

import TopHeader from '../../../components/top-header'

export const getServerSideProps = getGetServerSideProps(ITEMS, { sort: 'top' })

export default function Index ({ data: { items: { items, cursor } } }) {
  const router = useRouter()

  return (
    <Layout>
      <TopHeader cat='posts' />
      <Items
        items={items} cursor={cursor}
        variables={{ sort: 'top', within: router.query?.within }} rank
      />
    </Layout>
  )
}
