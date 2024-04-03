import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import UserList from '@/components/user-list'
import { MY_SUBSCRIBED_USERS } from '@/fragments/users'
import { SettingsHeader } from '../index'
import { SubscribeUserContextProvider } from '@/components/subscribeUser'

export const getServerSideProps = getGetServerSideProps({ query: MY_SUBSCRIBED_USERS, authRequired: true })

export default function MySubscribedUsers ({ ssrData }) {
  return (
    <Layout>
      <div className='pb-3 w-100 mt-2'>
        <SettingsHeader />
        <div className='mb-2'>These here are stackers you've hitched your wagon to, partner.</div>
        <SubscribeUserContextProvider value={{ refetchQueries: ['MySubscribedUsers'] }}>
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
