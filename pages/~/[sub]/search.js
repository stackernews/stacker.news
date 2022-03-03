import Layout from '../../../components/layout'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import SearchItems from '../../../components/search-items'
import { useRouter } from 'next/router'
import { SeoSearch } from '../../../components/seo'
import { SUB_SEARCH } from '../../../fragments/subs'

export const getServerSideProps = getGetServerSideProps(SUB_SEARCH, null, 'sub', 'q')

export default function Index ({ data: { sub: { name }, search: { items, cursor } } }) {
  const router = useRouter()

  return (
    <Layout sub={name} noSeo>
      <SeoSearch sub={name} />
      <SearchItems
        items={items} cursor={cursor} variables={{ q: router.query?.q, sub: name }}
      />
    </Layout>
  )
}
