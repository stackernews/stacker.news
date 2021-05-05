import { signOut, signIn, useSession } from 'next-auth/client'
import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import Link from 'next/link'
import styles from './header.module.css'
import { useRouter } from 'next/router'
import { Button, Container, NavDropdown } from 'react-bootstrap'
import Price from './price'

export default function Header () {
  const [session, loading] = useSession()
  const router = useRouter()
  const path = router.asPath.split('?')[0]

  const Corner = () => {
    if (loading) {
      return null
    }

    if (session) {
      return (
        <div className='d-flex align-items-center'>
          <NavDropdown title={`@${session.user.name}`} alignRight>
            <Link href={'/' + session.user.name} passHref>
              <NavDropdown.Item>profile</NavDropdown.Item>
            </Link>
            <Link href='/fund' passHref>
              <NavDropdown.Item className='text-success'>fund [0,0]</NavDropdown.Item>
            </Link>
            <NavDropdown.Item onClick={signOut}>logout</NavDropdown.Item>
          </NavDropdown>
          <Nav.Item>
            <Link href='/fund' passHref>
              <Nav.Link className='text-success pl-0'>[0,0]</Nav.Link>
            </Link>
          </Nav.Item>
        </div>
      )
    } else {
      return path !== '/login' && <Button href='/login' onClick={signIn}>login</Button>
    }
  }

  return (
    <>
      <Container className='px-sm-0'>
        <Navbar className={styles.navbar}>
          <Nav className='w-100 justify-content-between flex-wrap align-items-center' activeKey={path}>
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
