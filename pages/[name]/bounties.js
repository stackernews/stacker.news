import { BOUNTY_ITEMS_BY_USER_NAME } from '../../fragments/items'
import { getGetServerSideProps } from '../../api/ssrApollo'
import Items from '../../components/items'
import Layout from '../../components/layout'
import { useRouter } from 'next/router'

export const getServerSideProps = getGetServerSideProps(BOUNTY_ITEMS_BY_USER_NAME)

export default function Bounties ({ data: { getBountiesByUserName: { items, cursor } } }) {
  const router = useRouter()

  return (
    <Layout>
      <div className='font-weight-bold my-2'>{router.query.name}'s bounties</div>
      <Items
        items={items} cursor={cursor}
        variables={{ name: router.query.name }}
        destructureData={data => data.getBountiesByUserName}
        query={BOUNTY_ITEMS_BY_USER_NAME}
      />
    </Layout>
  )
}
