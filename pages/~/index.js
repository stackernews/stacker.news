import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../api/ssrApollo'
import Items from '../../components/items'
import Layout from '../../components/layout'
import { SUB_ITEMS } from '../../fragments/subs'

export const getServerSideProps = getGetServerSideProps(SUB_ITEMS, null,
  (data, vars) => vars.sub && !data.sub)

export default function Sub ({ ssrData }) {
  const router = useRouter()
  const variables = { ...router.query }

  return (
    <Layout sub={variables.sub}>
      <Items ssrData={ssrData} variables={variables} />
    </Layout>
  )
}
