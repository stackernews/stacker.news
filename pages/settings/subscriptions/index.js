import { useMemo, useState } from 'react'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import { Select } from '@/components/form'
import UserList from '@/components/user-list'
import TerritoryList from '@/components/territory-list'
import { MY_SUBSCRIPTIONS } from '@/fragments/users'
import { SettingsHeader } from '../index'
import { SubscribeUserContextProvider } from '@/components/subscribeUser'
import { SubscribeTerritoryContextProvider } from '@/components/territory-header'

export const getServerSideProps = getGetServerSideProps({
  query: MY_SUBSCRIPTIONS,
  authRequired: true
})

export default function MySubscribedUsers ({ ssrData }) {
  const [view, setView] = useState('stackers')
  const subscribeContextValue = useMemo(() => ({ refetchQueries: ['MySubscriptions'] }), [])

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
          value={view}
          onChange={(_, e) => setView(e.target.value)}
        />
        {view === 'stackers'
          ? (
            <SubscribeUserContextProvider value={subscribeContextValue}>
              <UserList
                ssrData={ssrData}
                query={MY_SUBSCRIPTIONS}
                destructureData={data => data.mySubscribedUsers}
                variables={{}}
                rank
                nymActionDropdown
                statCompsProp={[]}
              />
            </SubscribeUserContextProvider>
            )
          : (
            <SubscribeTerritoryContextProvider value={subscribeContextValue}>
              <TerritoryList
                ssrData={ssrData}
                query={MY_SUBSCRIPTIONS}
                variables={{}}
                destructureData={data => data.mySubscribedSubs}
                rank
                statCompsProp={[]}
              />
            </SubscribeTerritoryContextProvider>
            )}
      </div>
    </Layout>
  )
}
