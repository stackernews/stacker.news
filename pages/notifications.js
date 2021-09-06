import { useRouter } from 'next/router'
import Layout from '../components/layout'
import Notifications from '../components/notifications'

export default function NotificationPage () {
  const router = useRouter()
  return (
    <Layout>
      <Notifications key={router.query.key} />
    </Layout>
  )
}
