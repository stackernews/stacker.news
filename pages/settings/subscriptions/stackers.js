import { useMemo } from 'react'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import { Select } from '@/components/form'
import UserList from '@/components/user-list'
import { MY_SUBSCRIBED_USERS } from '@/fragments/users'
import { SettingsHeader } from '../index'
import { SubscribeUserContextProvider } from '@/components/subscribeUser'
import { useRouter } from 'next/router'

export const getServerSideProps = getGetServerSideProps({
  query: MY_SUBSCRIBED_USERS,
  authRequired: true
})

export function SubscriptionLayout ({ subType, children }) {
  const router = useRouter()

  return (
    <Layout>
      <div className='pb-3 w-100 mt-2'>
        <SettingsHeader />
        <Select
          name='subscriptionType'
          size='sm'
          className='w-auto'
          noForm
          items={['stackers', 'territories']}
          value={subType}
          onChange={(_, e) => router.push(`/settings/subscriptions/${e.target.value}`)}
        />
        {children}
      </div>
    </Layout>
  )
}

export default function MySubscribedUsers ({ ssrData }) {
  const subscribeContextValue = useMemo(() => ({ refetchQueries: ['MySubscribedUsers'] }), [])
  return (
    <SubscriptionLayout subType='stackers'>
      <SubscribeUserContextProvider value={subscribeContextValue}>
        <UserList
          ssrData={ssrData}
          query={MY_SUBSCRIBED_USERS}
          destructureData={data => data.mySubscribedUsers}
          variables={{}}
          rank
          nymActionDropdown
          statCompsProp={[]}
        />
      </SubscribeUserContextProvider>
    </SubscriptionLayout>
  )
}
