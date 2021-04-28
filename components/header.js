import { signOut, signIn, useSession } from 'next-auth/client'
import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import Link from 'next/link'
import styles from './header.module.css'
import { useRouter } from 'next/router'
import { Container } from 'react-bootstrap'

export default function Header () {
  const [session, loading] = useSession()
  const router = useRouter()

  const Corner = () => {
    if (loading) {
      return null
    }

    if (session) {
      return (
        <>
          <Nav.Item>
            <Link href={'/' + session.user.name} passHref>
              <Nav.Link className={styles.navLink}>@{session.user.name}</Nav.Link>
            </Link>
          </Nav.Item>
          {/* <Nav.Item>
            <Nav.Link onClick={signOut} className={styles.navLink}>logout</Nav.Link>
          </Nav.Item> */}
        </>
      )
    } else {
      return <Nav.Link href='/login' onClick={signIn}>login</Nav.Link>
    }
  }

  return (
    <>
      <Container className='px-sm-0'>
        <Navbar className={styles.navbar}>
          <Nav className='w-100 justify-content-sm-between justify-content-start flex-wrap align-items-center' activeKey={router.asPath.split('?')[0]}>
            <Link href='/' passHref>
              <Navbar.Brand className={`${styles.brand} mr-2 mr-sm-0`}>STACKER NEWS</Navbar.Brand>
            </Link>
            <Nav.Item>
              <Link href='/recent' passHref>
                <Nav.Link className={styles.navLink}>recent</Nav.Link>
              </Link>
            </Nav.Item>
            <Nav.Item>
              <Link href='/post' passHref>
                <Nav.Link className={styles.navLink}>post</Nav.Link>
              </Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link href='https://bitcoinerjobs.co' target='_blank' className={styles.navLink}>jobs</Nav.Link>
            </Nav.Item>
            <Corner />
          </Nav>
        </Navbar>
      </Container>
    </>
  )
}
