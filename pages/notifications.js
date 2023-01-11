import { getGetServerSideProps } from '../api/ssrApollo'
import Layout from '../components/layout'
import Notifications from '../components/notifications'
import { NOTIFICATIONS } from '../fragments/notifications'
import { useRouter } from 'next/router'

export const getServerSideProps = getGetServerSideProps(NOTIFICATIONS)

export default function NotificationPage ({ data: { notifications: { notifications, cursor, lastChecked } } }) {
  const router = useRouter()

  return (
    <Layout>
      <Notifications
        notifications={notifications} cursor={cursor}
        lastChecked={lastChecked} variables={{ inc: router.query?.inc }}
      />
    </Layout>
  )
}
