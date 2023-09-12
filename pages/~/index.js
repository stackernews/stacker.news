import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../api/ssrApollo'
import Items from '../../components/items'
import Layout from '../../components/layout'
import { SUB_ITEMS } from '../../fragments/subs'
import Snl from '../../components/snl'
import WelcomeBanner from '../../components/banners'

export const getServerSideProps = getGetServerSideProps({
  query: SUB_ITEMS,
  notFound: (data, vars) => vars.sub && !data.sub
})

export default function Sub ({ ssrData }) {
  const router = useRouter()
  const variables = { ...router.query }

  return (
    <Layout sub={variables.sub}>
      <Snl />
      <WelcomeBanner />
      <Items ssrData={ssrData} variables={variables} />
    </Layout>
  )
}
