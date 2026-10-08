import { useRouter } from 'next/router'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Items from '@/components/items'
import Layout from '@/components/layout'
import { SUB_FULL, SUB_ITEMS } from '@/fragments/subs'
import Snl from '@/components/snl'
import { useQuery } from '@apollo/client/react'
import PageLoading from '@/components/page-loading'
import TerritoryHeader from '@/components/territory-header'
import FeedSidebar from '@/components/feed-sidebar'
import useDesktopSidebar from '@/components/use-desktop-sidebar'

export const getServerSideProps = getGetServerSideProps({
  query: SUB_ITEMS,
  notFound: (data, vars) => vars.sub && !data.sub
})

export default function Sub ({ ssrData }) {
  const router = useRouter()
  const variables = { ...router.query }
  const { data } = useQuery(SUB_FULL, { variables })
  const desktopSidebar = useDesktopSidebar()

  if (!data && !ssrData) return <PageLoading />
  const { sub } = data || ssrData

  return (
    <Layout sub={sub?.name} twoColumns sidebar={<FeedSidebar sub={sub} />}>
      {sub
        ? !desktopSidebar && <div className='md:hidden'><TerritoryHeader key={sub.name} sub={sub} /></div>
        : (
          <>
            <Snl />
          </>)}
      <Items ssrData={ssrData} variables={variables} />
    </Layout>
  )
}
