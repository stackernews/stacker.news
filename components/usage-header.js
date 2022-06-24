import Link from 'next/link'
import { useRouter } from 'next/router'
import { Nav, Navbar } from 'react-bootstrap'
import styles from './header.module.css'

export function UsageHeader () {
  const router = useRouter()
  return (
    <Navbar className='pt-0'>
      <Nav
        className={`${styles.navbarNav} justify-content-around`}
        activeKey={router.asPath}
      >
        <Nav.Item>
          <Link href='/users/week' passHref>
            <Nav.Link
              className={styles.navLink}
            >
              week
            </Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href='/users/forever' passHref>
            <Nav.Link
              className={styles.navLink}
            >
              forever
            </Nav.Link>
          </Link>
        </Nav.Item>
      </Nav>
    </Navbar>
  )
}
