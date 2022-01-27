import Layout from '../components/layout'
import { getGetServerSideProps } from '../api/ssrApollo'
import { ITEM_SEARCH } from '../fragments/items'
import SearchItems from '../components/search-items'
import { useRouter } from 'next/router'

export const getServerSideProps = getGetServerSideProps(ITEM_SEARCH)

export default function Index ({ data: { search: { items, cursor } } }) {
  const router = useRouter()
  return (
    <Layout>
      <SearchItems
        items={items} cursor={cursor} variables={{ q: router.query?.q }}
      />
    </Layout>
  )
}
