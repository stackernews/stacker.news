import { getGetServerSideProps } from '@/api/ssrApollo'
import { SUBS } from '@/fragments/subs'
import { CenterLayout } from '@/components/layout'
import Post from '@/components/post'
import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'
import PageLoading from '@/components/page-loading'
import { subNamesFromSlug } from '@/lib/subs'

export const getServerSideProps = getGetServerSideProps({
  query: SUBS,
  variables: vars => ({ subNames: subNamesFromSlug(vars.sub) }),
  notFound: (data, vars) => vars.sub && !subNamesFromSlug(vars.sub).every(s => data?.subs?.some(sub => sub.name === s))
})

export default function PostPage ({ ssrData }) {
  const router = useRouter()
  const names = subNamesFromSlug(router.query.sub)
  const { data } = useQuery(SUBS, { variables: { subNames: names } })
  if (!data && !ssrData) return <PageLoading />

  const { subs } = data || ssrData

  return (
    <CenterLayout>
      <Post subs={subs} />
    </CenterLayout>
  )
}
