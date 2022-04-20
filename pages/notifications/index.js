import { Nav, Navbar } from 'react-bootstrap'
import { getGetServerSideProps } from '../../api/ssrApollo'
import Layout from '../../components/layout'
import Notifications from '../../components/notifications'
import { NOTIFICATIONS } from '../../fragments/notifications'
import styles from '../../components/header.module.css'
import Link from 'next/link'
import { useRouter } from 'next/router'

export const getServerSideProps = getGetServerSideProps(NOTIFICATIONS)

export default function NotificationPage ({ data: { notifications: { notifications, cursor, lastChecked } } }) {
  const router = useRouter()

  return (
    <Layout>
      <NotificationHeader />
      <Notifications
        notifications={notifications} cursor={cursor}
        lastChecked={lastChecked} variables={{ filter: router.query?.filter }}
      />
    </Layout>
  )
}

export function NotificationHeader () {
  const router = useRouter()
  return (
    <Navbar className='pt-0'>
      <Nav
        className={`${styles.navbarNav} justify-content-around`}
        activeKey={router.asPath}
      >
        <Nav.Item>
          <Link href='/notifications' passHref>
            <Nav.Link
              className={styles.navLink}
            >
              all
            </Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href='/notifications/replies' passHref>
            <Nav.Link
              className={styles.navLink}
            >
              replies
            </Nav.Link>
          </Link>
        </Nav.Item>
      </Nav>
    </Navbar>
  )
}
