import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import PayIn from '@/components/payIn'
import { useRouter } from 'next/router'

// force SSR to include CSP nonces
export const getServerSideProps = getGetServerSideProps({ query: null })

export default function Transaction () {
  const router = useRouter()

  return (
    <Layout containClassName='p-5'>
      <PayIn id={Number(router.query.id)} />
    </Layout>
  )
}
