import { useMemo } from 'react'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import UserList from '@/components/user-list'
import { MY_SUBSCRIBED_USERS } from '@/fragments/users'
import { SettingsHeader } from '../index'
import { SubscribeUserContextProvider } from '@/components/subscribeUser'

export const getServerSideProps = getGetServerSideProps({ query: MY_SUBSCRIBED_USERS, authRequired: true })

export default function MySubscribedUsers ({ ssrData }) {
  const subscribeUserContextValue = useMemo(() => ({ refetchQueries: ['MySubscribedUsers'] }), [])
  return (
    <Layout>
      <div className='pb-3 w-100 mt-2'>
        <SettingsHeader />
        <div className='mb-4 text-muted'>These here are stackers you've hitched your wagon to, pardner.</div>
        <SubscribeUserContextProvider value={subscribeUserContextValue}>
          <UserList
            ssrData={ssrData} query={MY_SUBSCRIBED_USERS}
            destructureData={data => data.mySubscribedUsers}
            variables={{}}
            rank
            nymActionDropdown
            statCompsProp={[]}
          />
        </SubscribeUserContextProvider>
      </div>
    </Layout>
  )
}
