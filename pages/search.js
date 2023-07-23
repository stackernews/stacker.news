import Layout from '../components/layout'
import { getGetServerSideProps } from '../api/ssrApollo'
import { ITEM_SEARCH } from '../fragments/items'
import SearchItems from '../components/search-items'
import { useRouter } from 'next/router'
import { SeoSearch } from '../components/seo'
import Down from '../svgs/arrow-down-line.svg'

export const getServerSideProps = getGetServerSideProps(ITEM_SEARCH)

export default function Index ({ data: { search: { items, cursor } } }) {
  const router = useRouter()

  return (
    <Layout noSeo search>
      <SeoSearch />
      {router.query?.q
        ? <SearchItems
            items={items} cursor={cursor}
            variables={{ q: router.query?.q, sort: router.query?.sort, what: router.query?.what, when: router.query?.when }}
          />
        : (
          <div className='text-muted text-center mt-5' style={{ fontFamily: 'lightning', fontSize: '2rem', opacity: '0.75' }}>
            <Down width={22} height={22} className='mr-2' />search for something<Down width={22} height={22} className='ml-2' />
          </div>)}
    </Layout>
  )
}
