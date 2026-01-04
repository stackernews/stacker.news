import { getGetServerSideProps } from '@/api/ssrApollo'
import { SUBS } from '@/fragments/subs'
import { CenterLayout } from '@/components/layout'
import Post from '@/components/post'
import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'
import PageLoading from '@/components/page-loading'

export const getServerSideProps = getGetServerSideProps({
  query: SUBS,
  variables: vars => ({ subNames: vars.sub?.split('~').filter(Boolean) || [] }),
  notFound: (data, vars) => vars.sub && !vars.sub.split('~').every(s => data?.subs?.some(sub => sub.name === s))
})

export default function PostPage ({ ssrData }) {
  const router = useRouter()
  const subNames = router.query.sub?.split('~').filter(Boolean) || []
  const { data } = useQuery(SUBS, { variables: { subNames } })
  if (!data && !ssrData) return <PageLoading />

  const { subs } = data || ssrData

  return (
    <CenterLayout>
      <Post subs={subs} />
    </CenterLayout>
  )
}
