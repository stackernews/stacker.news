import { useEffect } from 'react'
import { getGetServerSideProps } from '../api/ssrApollo'
import Layout from '../components/layout'
import Notifications, { NotificationAlert } from '../components/notifications'
import { HAS_NOTIFICATIONS, NOTIFICATIONS } from '../fragments/notifications'
import { useApolloClient } from '@apollo/client'

export const getServerSideProps = getGetServerSideProps(NOTIFICATIONS)

export default function NotificationPage ({ ssrData }) {
  const client = useApolloClient()

  useEffect(() => {
    client?.writeQuery({
      query: HAS_NOTIFICATIONS,
      data: {
        hasNewNotes: false
      }
    })
  }, [])

  return (
    <Layout>
      <NotificationAlert />
      <Notifications ssrData={ssrData} />
    </Layout>
  )
}
