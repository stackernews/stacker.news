import { useRouter } from 'next/router'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Items from '@/components/items'
import Layout from '@/components/layout'
import { SUB_FULL, SUB_ITEMS } from '@/fragments/subs'
import Snl from '@/components/snl'
import { useQuery } from '@apollo/client'
import PageLoading from '@/components/page-loading'
import TerritoryHeader from '@/components/territory-header'
import Link from 'next/link'

export const getServerSideProps = getGetServerSideProps({
  query: SUB_ITEMS,
  notFound: (data, vars) => vars.sub && !data.sub
})

export default function Sub ({ ssrData }) {
  const router = useRouter()
  const variables = { ...router.query }
  const { data } = useQuery(SUB_FULL, { variables })

  if (!data && !ssrData) return <PageLoading />
  const { sub } = data || ssrData

  return (
    <Layout sub={sub?.name}>
      {sub
        ? <TerritoryHeader sub={sub} />
        : (
          <>
            <Snl />
          </>)}
      <small className='pb-3 px-1 text-muted' style={{ marginTop: '-0.25rem', lineHeight: 1.5 }}>
        <Link className='text-reset' href='/rewards' style={{ textDecoration: 'underline' }}>
          Million Sat Madness
        </Link> is sponsored by{' '}
        <Link className='text-reset' href='https://btcplusplus.dev/conf/atx24' target='_blank' rel='noreferrer' style={{ textDecoration: 'underline' }}>
          the Austin Bitcoin++ Conference May 1-4
        </Link>
      </small>
      <Items ssrData={ssrData} variables={variables} />
    </Layout>
  )
}
