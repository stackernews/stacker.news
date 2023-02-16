import Layout from '../../components/layout'
import { useQuery } from '@apollo/client'
import UserHeader from '../../components/user-header'
import Seo from '../../components/seo'
import Items from '../../components/items'
import { USER_WITH_BOOKMARKS } from '../../fragments/users'
import { getGetServerSideProps } from '../../api/ssrApollo'

export const getServerSideProps = getGetServerSideProps(USER_WITH_BOOKMARKS)

export default function UserBookmarks ({ data: { user, moreBookmarks: { items, cursor } } }) {
  const { data } = useQuery(
    USER_WITH_BOOKMARKS, { variables: { name: user.name } })

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
          query={USER_WITH_BOOKMARKS}
          destructureData={data => data.moreBookmarks}
          variables={{ name: user.name }}
        />
      </div>
    </Layout>
  )
}
