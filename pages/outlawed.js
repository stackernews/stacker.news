import Layout from '../components/layout'
import { ItemsSkeleton } from '../components/items'
import { getGetServerSideProps } from '../api/ssrApollo'
import { OUTLAWED_ITEMS } from '../fragments/items'
import { useQuery } from '@apollo/client'
import MixedItems from '../components/items-mixed'

export const getServerSideProps = getGetServerSideProps(OUTLAWED_ITEMS)

export default function Index ({ data: { outlawedItems: { items, cursor } } }) {
  return (
    <Layout>
      <Items
        items={items} cursor={cursor}
      />
    </Layout>
  )
}

function Items ({ rank, items, cursor }) {
  const { data, fetchMore } = useQuery(OUTLAWED_ITEMS)

  if (!data && !items) {
    return <ItemsSkeleton rank={rank} />
  }

  if (data) {
    ({ outlawedItems: { items, cursor } } = data)
  }

  return <MixedItems items={items} cursor={cursor} rank={rank} fetchMore={fetchMore} />
}
