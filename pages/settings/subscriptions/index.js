import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import UserList from '@/components/user-list'
import { MY_SUBSCRIBED_USERS } from '@/fragments/users'
import ActionDropdown from '@/components/action-dropdown'
import MuteDropdownItem from '@/components/mute'
import SubscribeUserDropdownItem from '@/components/subscribeUser'
import { SettingsHeader } from '../index'

export const getServerSideProps = getGetServerSideProps({ query: MY_SUBSCRIBED_USERS, authRequired: true })

export default function MySubscribedUsers ({ ssrData }) {
  return (
    <Layout>
      <div className='pb-3 w-100 mt-2' style={{ maxWidth: '600px' }}>
        <SettingsHeader />
        <UserList
          ssrData={ssrData} query={MY_SUBSCRIBED_USERS}
          destructureData={data => data.mySubscribedUsers}
          rank
          statCompsProp={[]}
          Embellish={
            ({ user }) =>
              <div className='ms-2'>
                <ActionDropdown>
                  <SubscribeUserDropdownItem user={user} target='posts' />
                  <SubscribeUserDropdownItem user={user} target='comments' />
                  <MuteDropdownItem user={user} />
                </ActionDropdown>
              </div>
            }
        />
      </div>
    </Layout>

  )
}
