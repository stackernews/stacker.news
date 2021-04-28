import { signOut, signIn, useSession } from 'next-auth/client'
import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import Link from 'next/link'
import styles from './header.module.css'
import { useRouter } from 'next/router'
import { Container, NavDropdown } from 'react-bootstrap'
import Price from './price'

export default function Header () {
  const [session, loading] = useSession()
  const router = useRouter()

  const Corner = () => {
    if (loading) {
      return null
    }

    if (session) {
      return (
        <NavDropdown title={`@${session.user.name}`} alignRight>
          <Link href={'/' + session.user.name} passHref>
            <NavDropdown.Item>profile</NavDropdown.Item>
          </Link>
          <NavDropdown.Item className='text-muted' onClick={signOut}>logout</NavDropdown.Item>
        </NavDropdown>
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
              <Navbar.Brand className={`${styles.brand} mr-2 d-none d-sm-block`}>STACKER NEWS</Navbar.Brand>
            </Link>
            <Link href='/' passHref>
              <Navbar.Brand className={`${styles.brand} mr-2 d-block d-sm-none`}>SN</Navbar.Brand>
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
            <Nav.Item style={{ fontFamily: 'monospace', opacity: '.5' }}>
              <Price />
            </Nav.Item>
            <Corner />
          </Nav>
        </Navbar>
      </Container>
    </>
  )
}
