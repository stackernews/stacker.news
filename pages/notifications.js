import { useEffect } from 'react'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import Notifications, { NotificationsHeader } from '@/components/notifications'
import { HAS_NOTIFICATIONS, NOTIFICATIONS } from '@/fragments/notifications'
import { useApolloClient } from '@apollo/client'
import { clearNotifications } from '@/lib/badge'

export const getServerSideProps = getGetServerSideProps({ query: NOTIFICATIONS, authRequired: true })

export default function NotificationPage ({ ssrData }) {
  const client = useApolloClient()

  useEffect(() => {
    client?.writeQuery({
      query: HAS_NOTIFICATIONS,
      data: {
        hasNewNotes: false
      }
    })
    clearNotifications()
  }, [ssrData])

  return (
    <Layout>
      <NotificationsHeader />
      <Notifications ssrData={ssrData} />
    </Layout>
  )
}
