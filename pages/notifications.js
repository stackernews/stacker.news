import { getGetServerSideProps } from '../api/ssrApollo'
import Layout from '../components/layout'
import Notifications from '../components/notifications'
import { NOTIFICATIONS } from '../fragments/notifications'

export const getServerSideProps = getGetServerSideProps(NOTIFICATIONS)

export default function NotificationPage ({ data: { notifications: { notifications, cursor, lastChecked } } }) {
  return (
    <Layout>
      <Notifications
        notifications={notifications} cursor={cursor}
        lastChecked={lastChecked}
      />
    </Layout>
  )
}
