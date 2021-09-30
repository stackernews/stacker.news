import { useRouter } from 'next/router'
import getSSRApolloClient from '../api/ssrApollo'
import Layout from '../components/layout'
import Notifications from '../components/notifications'
import { NOTIFICATIONS } from '../fragments/notifications'

export async function getServerSideProps ({ req }) {
  const client = await getSSRApolloClient(req)
  const { data } = await client.query({
    query: NOTIFICATIONS
  })

  let notifications, cursor, lastChecked
  if (data) {
    ({ notifications: { notifications, cursor, lastChecked } } = data)
  }

  return {
    props: {
      notifications,
      cursor,
      lastChecked
    }
  }
}

export default function NotificationPage ({ notifications, cursor, lastChecked }) {
  const router = useRouter()
  return (
    <Layout>
      <Notifications
        notifications={notifications} cursor={cursor}
        lastChecked={lastChecked} key={router.query.key}
      />
    </Layout>
  )
}
