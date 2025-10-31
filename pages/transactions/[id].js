import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import PayIn from '@/components/payIn'
import { GET_PAY_IN_FULL } from '@/fragments/payIn'
import { useRouter } from 'next/router'

// force SSR to include CSP nonces
export const getServerSideProps = getGetServerSideProps({ query: GET_PAY_IN_FULL, variables: ({ id }) => ({ id: Number(id) }) })

export default function Transaction ({ ssrData }) {
  const router = useRouter()

  return (
    <Layout containClassName='p-5'>
      <PayIn id={Number(router.query.id)} ssrData={ssrData} />
    </Layout>
  )
}
