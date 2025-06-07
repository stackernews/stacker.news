import { useMemo, useState } from 'react'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import { Select } from '@/components/form'
import UserList from '@/components/user-list'
import TerritoryList from '@/components/territory-list'
import { MY_SUBSCRIBED_USERS } from '@/fragments/users'
import { MY_SUBSCRIBED_SUBS } from '@/fragments/subs'
import { SettingsHeader } from '../index'
import { SubscribeUserContextProvider } from '@/components/subscribeUser'

export const getServerSideProps = async (ctx) => {
  const [userRes, subsRes] = await Promise.all([
    getGetServerSideProps({ query: MY_SUBSCRIBED_USERS, authRequired: true })(ctx),
    getGetServerSideProps({ query: MY_SUBSCRIBED_SUBS, authRequired: true })(ctx)
  ])
  return {
    props: {
      ssrUsers: userRes.props.ssrData,
      ssrSubs: subsRes.props.ssrData
    }
  }
}

export default function MySubscribedUsers ({ ssrUsers, ssrSubs }) {
  const [view, setView] = useState('stackers')
  const subscribeUserContextValue = useMemo(() => ({ refetchQueries: ['MySubscribedUsers'] }), [])
  return (
    <Layout>
      <div className='pb-3 w-100 mt-2'>
        <SettingsHeader />
        <Select
          name='subscriptionType'
          size='sm'
          noForm
          items={['stackers', 'territories']}
          value={view}
          onChange={(_, e) => setView(e.target.value)}
        />
        {view === 'stackers'
          ? (
            <>
              <div className='mb-2 text-muted'>These here are stackers you've hitched your wagon to, pardner.</div>
              <SubscribeUserContextProvider value={subscribeUserContextValue}>
                <UserList
                  ssrData={ssrUsers}
                  query={MY_SUBSCRIBED_USERS}
                  destructureData={data => data.mySubscribedUsers}
                  variables={{}}
                  rank
                  nymActionDropdown
                  statCompsProp={[]}
                />
              </SubscribeUserContextProvider>
            </>
            )
          : (
            <>
              <div className='mb-2 text-muted'>These here are the territories you've set camp on, pardner.</div>
              <TerritoryList
                ssrData={ssrSubs}
                query={MY_SUBSCRIBED_SUBS}
                variables={{}}
                destructureData={data => data.mySubscribedSubs}
                rank
                statCompsProp={[]}
              />
            </>
            )}
      </div>
    </Layout>
  )
}
