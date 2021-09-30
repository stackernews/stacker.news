import Layout from '../../components/layout'
import { useQuery } from '@apollo/client'
import UserHeader from '../../components/user-header'
import Seo from '../../components/seo'
import Items from '../../components/items'
import { useRouter } from 'next/router'
import { USER_FULL } from '../../fragments/users'
import { getServerSideProps as headerProps } from './index'
import getSSRApolloClient from '../../api/ssrApollo'
import { MORE_ITEMS } from '../../fragments/items'

export async function getServerSideProps ({ req, params: { username } }) {
  const { notFound, props } = await headerProps({ req, params: { username } })

  if (notFound) {
    return {
      notFound
    }
  }

  const { user } = props
  const client = await getSSRApolloClient(req)
  const { data } = await client.query({
    query: MORE_ITEMS,
    variables: { sort: 'user', userId: user.id }
  })

  let items, cursor
  if (data) {
    ({ moreItems: { items, cursor } } = data)
  }

  return {
    props: {
      ...props,
      items,
      cursor
    }
  }
}

export default function UserPosts ({ user, items, cursor }) {
  const router = useRouter()

  const { data } = useQuery(
    USER_FULL(user.name), {
      fetchPolicy: router.query.cache ? 'cache-first' : undefined
    })

  if (data) {
    ({ user } = data)
  }

  return (
    <Layout noSeo>
      <Seo user={user} />
      <UserHeader user={user} />
      <Items
        items={items} cursor={cursor}
        variables={{ sort: 'user', userId: user.id }}
      />
    </Layout>
  )
}
