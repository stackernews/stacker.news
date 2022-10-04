import { Nav, Navbar } from 'react-bootstrap'
import styles from './header.module.css'
import Link from 'next/link'

export default function RecentHeader ({ itemType }) {
  return (
    <Navbar className='pt-0'>
      <Nav
        className={`${styles.navbarNav} justify-content-around`}
        activeKey={itemType}
      >
        <Nav.Item>
          <Link href='/recent' passHref>
            <Nav.Link
              eventKey='posts'
              className={styles.navLink}
            >
              posts
            </Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href='/recent/comments' passHref>
            <Nav.Link
              eventKey='comments'
              className={styles.navLink}
            >
              comments
            </Nav.Link>
          </Link>
        </Nav.Item>
      </Nav>
    </Navbar>
  )
}
