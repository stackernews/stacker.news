import { BOUNTY_ITEMS_BY_USER_NAME } from '../../fragments/items'
import { getGetServerSideProps } from '../../api/ssrApollo'
import Items from '../../components/items'
import Layout from '../../components/layout'
import { useRouter } from 'next/router'

export const getServerSideProps = getGetServerSideProps(BOUNTY_ITEMS_BY_USER_NAME)

export default function Bounties ({ data: { getBountiesByUserName } }) {
  const router = useRouter()

  if (!getBountiesByUserName) return null

  return (
    <Layout>
      <div className='font-weight-bold my-2'>past bounties</div>
      <Items
        items={getBountiesByUserName}
        variables={{ id: router.query.id }}
      />
    </Layout>
  )
}
