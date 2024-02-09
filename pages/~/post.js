import { getGetServerSideProps } from '../../api/ssrApollo'
import { SUB_FULL } from '../../fragments/subs'
import { CenterLayout } from '../../components/layout'
import Post from '../../components/post'
import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'
import PageLoading from '../../components/page-loading'

export const getServerSideProps = getGetServerSideProps({
  query: SUB_FULL,
  notFound: (data, vars) => vars.sub && !data.sub
})

export default function PostPage ({ ssrData }) {
  const router = useRouter()
  const { data } = useQuery(SUB_FULL, { variables: { sub: router.query.sub } })
  if (!data && !ssrData) return <PageLoading />

  const { sub } = data || ssrData

  return (
    <CenterLayout sub={sub?.name}>
      <Post sub={sub} />
    </CenterLayout>
  )
}
