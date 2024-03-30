import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import UserList from '@/components/user-list'
import { MY_SUBSCRIBED_USERS } from '@/fragments/users'
import { NymActionDropdown } from '@/components/user-header'
import { SettingsHeader } from '../index'

export const getServerSideProps = getGetServerSideProps({ query: MY_SUBSCRIBED_USERS, authRequired: true })

export default function MySubscribedUsers ({ ssrData }) {
  return (
    <Layout>
      <div className='pb-3 w-100 mt-2'>
        <SettingsHeader />
        You're subscribed to the following stackers
        <UserList
          ssrData={ssrData} query={MY_SUBSCRIBED_USERS}
          destructureData={data => data.mySubscribedUsers}
          variables={{}}
          rank
          statCompsProp={[]}
          Embellish={NymActionDropdown}
        />
      </div>
    </Layout>
  )
}
