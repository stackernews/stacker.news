import { getGetServerSideProps } from '../api/ssrApollo'
import Layout from '../components/layout'
import Notifications from '../components/notifications'
import { NOTIFICATIONS } from '../fragments/notifications'

export const getServerSideProps = getGetServerSideProps(NOTIFICATIONS)

export default function NotificationPage ({ ssrData }) {
  return (
    <Layout>
      <Notifications ssrData={ssrData} />
    </Layout>
  )
}
