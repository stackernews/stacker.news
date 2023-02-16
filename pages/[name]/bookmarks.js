import Layout from '../../components/layout'
import { useQuery } from '@apollo/client'
import UserHeader from '../../components/user-header'
import Seo from '../../components/seo'
import Items from '../../components/items'
import { USER_WITH_BOOKMARKS } from '../../fragments/users'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { useRouter } from 'next/router'

export const getServerSideProps = getGetServerSideProps(USER_WITH_BOOKMARKS)

export default function UserBookmarks ({ data: { user, moreBookmarks: { items, cursor } } }) {
  const router = useRouter()

  const { data } = useQuery(
    USER_WITH_BOOKMARKS, { variables: { name: router.query.name } })

  if (data) {
    ({ user, moreBookmarks: { items, cursor } } = data)
  }

  return (
    <Layout noSeo>
      <Seo user={user} />
      <UserHeader user={user} />
      <div className='mt-2'>
        <Items
          items={items} cursor={cursor}
          variables={{ name: user.name }}
        />
      </div>
    </Layout>
  )
}
