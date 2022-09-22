import Layout from '../components/layout'
import { ItemsSkeleton } from '../components/items'
import { getGetServerSideProps } from '../api/ssrApollo'
import { BORDERLAND_ITEMS } from '../fragments/items'
import { useQuery } from '@apollo/client'
import MixedItems from '../components/items-mixed'

export const getServerSideProps = getGetServerSideProps(BORDERLAND_ITEMS)

export default function Index ({ data: { borderlandItems: { items, cursor } } }) {
  return (
    <Layout>
      <Items
        items={items} cursor={cursor}
      />
    </Layout>
  )
}

function Items ({ rank, items, cursor }) {
  const { data, fetchMore } = useQuery(BORDERLAND_ITEMS)

  if (!data && !items) {
    return <ItemsSkeleton rank={rank} />
  }

  if (data) {
    ({ borderlandItems: { items, cursor } } = data)
  }

  return <MixedItems items={items} cursor={cursor} rank fetchMore={fetchMore} />
}
