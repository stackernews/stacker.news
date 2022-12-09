import Layout from '../components/layout'
import { ItemsSkeleton } from '../components/items'
import { getGetServerSideProps } from '../api/ssrApollo'
import { FREEBIE_ITEMS } from '../fragments/items'
import { useQuery } from '@apollo/client'
import MixedItems from '../components/items-mixed'

export const getServerSideProps = getGetServerSideProps(FREEBIE_ITEMS)

export default function Index ({ data: { freebieItems: { items, cursor } } }) {
  return (
    <Layout>
      <Items
        items={items} cursor={cursor}
      />
    </Layout>
  )
}

function Items ({ rank, items, cursor }) {
  const { data, fetchMore } = useQuery(FREEBIE_ITEMS)

  if (!data && !items) {
    return <ItemsSkeleton rank={rank} />
  }

  if (data) {
    ({ freebieItems: { items, cursor } } = data)
  }

  return <MixedItems items={items} cursor={cursor} rank={rank} fetchMore={fetchMore} />
}
