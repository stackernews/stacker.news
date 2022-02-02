import { Nav, Navbar } from 'react-bootstrap'
import styles from './header.module.css'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function TopHeader ({ cat }) {
  const router = useRouter()
  const within = router.query.within
  const userType = router.query.userType || 'stacked'

  return (
    <>
      <Navbar className='pt-0'>
        <Nav
          className={`${styles.navbarNav} justify-content-around`}
          activeKey={cat.split('/')[0]}
        >
          <Nav.Item>
            <Link href={`/top/posts/${within}`} passHref>
              <Nav.Link
                eventKey='posts'
                className={styles.navLink}
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
              >
                comments
              </Nav.Link>
            </Link>
          </Nav.Item>
          <Nav.Item>
            <Link href={`/top/users/stacked/${within}`} passHref>
              <Nav.Link
                eventKey='users'
                className={styles.navLink}
              >
                users
              </Nav.Link>
            </Link>
          </Nav.Item>
        </Nav>
      </Navbar>
      {cat.split('/')[0] === 'users' &&
        <Navbar className='pt-0'>
          <Nav
            className={`${styles.navbarNav} justify-content-around`}
            activeKey={userType}
          >
            <Nav.Item>
              <Link href={`/top/users/stacked/${within}`} passHref>
                <Nav.Link
                  eventKey='stacked'
                  className={styles.navLink}
                >
                  stacked
                </Nav.Link>
              </Link>
            </Nav.Item>
            <Nav.Item>
              <Link href={`/top/users/spent/${within}`} passHref>
                <Nav.Link
                  eventKey='spent'
                  className={styles.navLink}
                >
                  spent
                </Nav.Link>
              </Link>
            </Nav.Item>
          </Nav>
        </Navbar>}
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
