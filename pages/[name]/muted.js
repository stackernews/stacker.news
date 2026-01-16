import { getGetServerSideProps } from '@/api/ssrApollo'
import { useRouter } from 'next/router'
import { USER_MUTED_USERS } from '@/fragments/users'
import { useQuery } from '@apollo/client'
import PageLoading from '@/components/page-loading'
import { UserLayout } from '.'
import UserList from '@/components/user-list'
import { useMe } from '@/components/me'

export const getServerSideProps = getGetServerSideProps({ query: USER_MUTED_USERS })

export default function UserMuted ({ ssrData }) {
  const router = useRouter()
  const variables = { ...router.query }
  const { me } = useMe()
  const { data } = useQuery(USER_MUTED_USERS, { variables })
  if (!data && !ssrData) return <PageLoading />
  const { user } = data || ssrData
  const mutedData = data?.userMutedUsers || ssrData?.userMutedUsers
  const isPrivate = mutedData === null
  const isMe = me?.name === user.name
  return (
    <UserLayout user={user}>
      <div className='mt-2'>
        {isPrivate && !isMe
          ? (
            <div className='text-center text-muted mt-5'>
              <h4>Private List</h4>
              <p>@{user.name} has chosen to keep their muted stackers private.</p>
            </div>
            )
          : (
            <UserList
              ssrData={ssrData}
              query={USER_MUTED_USERS}
              variables={variables}
              destructureData={data => data.userMutedUsers || { users: [], cursor: null }}
              rank
              nymActionDropdown
              statCompsProp={[]}
            />
            )}
      </div>
    </UserLayout>
  )
}
