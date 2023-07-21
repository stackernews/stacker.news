import { getGetServerSideProps } from '../../api/ssrApollo'
import { SUB } from '../../fragments/subs'
import { CenterLayout } from '../../components/layout'
import Post from '../../components/post'
import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'
import PageLoading from '../../components/page-loading'

export const getServerSideProps = getGetServerSideProps(SUB, null,
  (data, vars) => vars.sub && !data.sub)

export default function PostPage ({ ssrData }) {
  const router = useRouter()
  const { data } = useQuery(SUB, { variables: { sub: router.query.sub } })
  if (!data && !ssrData) return <PageLoading />

  const { sub } = data || ssrData

  return (
    <CenterLayout sub={sub?.name}>
      <Post sub={sub} />
    </CenterLayout>
  )
}
