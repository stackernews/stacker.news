import { Nav, Navbar } from 'react-bootstrap'
import styles from './header.module.css'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function TopHeader ({ cat }) {
  const router = useRouter()
  const within = router.query.within

  return (
    <>
      <Navbar className='pt-0'>
        <Nav
          className={`${styles.navbarNav} justify-content-around`}
          activeKey={cat}
        >
          <Nav.Item>
            <Link href={`/top/posts/${within}`} passHref>
              <Nav.Link
                eventKey='posts'
                className={styles.navLink}
                onClick={() => localStorage.setItem('topWithin', 'day')}
              >
                posts
              </Nav.Link>
            </Link>
          </Nav.Item>
          <Nav.Item>
            <Link href={`/top/comments/${within}`} passHref>
              <Nav.Link
                eventKey='comments'
                className={styles.navLink}
                onClick={() => localStorage.setItem('topWithin', 'week')}
              >
                comments
              </Nav.Link>
            </Link>
          </Nav.Item>
          <Nav.Item>
            <Link href={`/top/users/${within}`} passHref>
              <Nav.Link
                eventKey='users'
                className={styles.navLink}
                onClick={() => localStorage.setItem('topWithin', 'month')}
              >
                users
              </Nav.Link>
            </Link>
          </Nav.Item>
        </Nav>
      </Navbar>
      <Navbar className='pt-0'>
        <Nav
          className={styles.navbarNav}
          activeKey={within}
        >
          <Nav.Item>
            <Link href={`/top/${cat}/day`} passHref>
              <Nav.Link
                eventKey='day'
                className={styles.navLink}
                onClick={() => localStorage.setItem('topWithin', 'day')}
              >
                day
              </Nav.Link>
            </Link>
          </Nav.Item>
          <Nav.Item>
            <Link href={`/top/${cat}/week`} passHref>
              <Nav.Link
                eventKey='week'
                className={styles.navLink}
                onClick={() => localStorage.setItem('topWithin', 'week')}
              >
                week
              </Nav.Link>
            </Link>
          </Nav.Item>
          <Nav.Item>
            <Link href={`/top/${cat}/month`} passHref>
              <Nav.Link
                eventKey='month'
                className={styles.navLink}
                onClick={() => localStorage.setItem('topWithin', 'month')}
              >
                month
              </Nav.Link>
            </Link>
          </Nav.Item>
          <Nav.Item>
            <Link href={`/top/${cat}/year`} passHref>
              <Nav.Link
                eventKey='year'
                className={styles.navLink}
                onClick={() => localStorage.setItem('topWithin', 'year')}
              >
                year
              </Nav.Link>
            </Link>
          </Nav.Item>
          <Nav.Item>
            <Link href={`/top/${cat}/forever`} passHref>
              <Nav.Link
                eventKey='forever'
                className={styles.navLink}
                onClick={() => localStorage.removeItem('topWithin')}
              >
                forever
              </Nav.Link>
            </Link>
          </Nav.Item>
        </Nav>
      </Navbar>
    </>
  )
}
