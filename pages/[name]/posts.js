import Layout from '../../components/layout'
import { useQuery } from '@apollo/client'
import UserHeader from '../../components/user-header'
import Seo from '../../components/seo'
import Items from '../../components/items'
import { USER_WITH_POSTS } from '../../fragments/users'
import { getGetServerSideProps } from '../../api/ssrApollo'

export const getServerSideProps = getGetServerSideProps(USER_WITH_POSTS, { sort: 'user' })

export default function UserPosts ({ data: { user, moreItems: { items, cursor } } }) {
  const { data } = useQuery(USER_WITH_POSTS,
    { variables: { name: user.name, sort: 'user' } })

  if (data) {
    ({ user, moreItems: { items, cursor } } = data)
  }

  return (
    <Layout noSeo>
      <Seo user={user} />
      <UserHeader user={user} />
      <div className='mt-2'>
        <Items
          items={items} cursor={cursor}
          variables={{ sort: 'user', name: user.name }}
        />
      </div>
    </Layout>
  )
}
