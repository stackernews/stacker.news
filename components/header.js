import { signOut, signIn, useSession } from 'next-auth/client'
import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import Link from 'next/link'
import styles from './header.module.css'
import { useRouter } from 'next/router'
import { Button, Container, NavDropdown } from 'react-bootstrap'
import Price from './price'
import { gql, useQuery } from '@apollo/client'

function WalletSummary () {
  const query = gql`
  {
    me {
      sats
      stacked
    }
  }`
  const { data } = useQuery(query, { pollInterval: 1000 })
  if (!data) return null

  return `[${data.me.stacked},${data.me.sats}]`
}

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
          <NavDropdown className='pl-0' title={`@${session.user.name}`} alignRight>
            <Link href={'/' + session.user.name} passHref>
              <NavDropdown.Item>profile</NavDropdown.Item>
            </Link>
            <Link href='/wallet' passHref>
              <NavDropdown.Item>wallet</NavDropdown.Item>
            </Link>
            <div>
              <NavDropdown.Divider />
              <Link href='/recent' passHref>
                <NavDropdown.Item>recent</NavDropdown.Item>
              </Link>
              <Link href='/post' passHref>
                <NavDropdown.Item>post</NavDropdown.Item>
              </Link>
              <NavDropdown.Item href='https://bitcoinerjobs.co' target='_blank'>jobs</NavDropdown.Item>
            </div>
            <NavDropdown.Divider />
            <NavDropdown.Item onClick={signOut}>logout</NavDropdown.Item>
          </NavDropdown>
          <Nav.Item>
            <Link href='/wallet' passHref>
              <Nav.Link className='text-success px-0'><WalletSummary /></Nav.Link>
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
              <Navbar.Brand className={`${styles.brand} d-none d-sm-block`}>STACKER NEWS</Navbar.Brand>
            </Link>
            <Link href='/' passHref>
              <Navbar.Brand className={`${styles.brand} d-block d-sm-none`}>SN</Navbar.Brand>
            </Link>
            <Nav.Item className='d-md-flex d-none'>
              <Link href='/recent' passHref>
                <Nav.Link className={styles.navLink}>recent</Nav.Link>
              </Link>
            </Nav.Item>
            <Nav.Item className='d-md-flex d-none'>
              <Link href='/post' passHref>
                <Nav.Link className={styles.navLink}>post</Nav.Link>
              </Link>
            </Nav.Item>
            <Nav.Item className='d-md-flex d-none'>
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
