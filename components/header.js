import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import Link from 'next/link'
import styles from './header.module.css'
import { useRouter } from 'next/router'
import { Button, Container, NavDropdown } from 'react-bootstrap'
import Price from './price'
import { useMe } from './me'
import { useApolloClient } from '@apollo/client'
import Head from 'next/head'
import { signOut, signIn, useSession } from 'next-auth/client'

function WalletSummary ({ me }) {
  return `[${me.stacked},${me.sats}]`
}

export default function Header () {
  const [session, loading] = useSession()
  const router = useRouter()
  const path = router.asPath.split('?')[0]
  const me = useMe()
  const client = useApolloClient()

  const Corner = () => {
    if (loading) {
      return null
    }

    if (session) {
      return (
        <div className='d-flex align-items-center'>
          {me && me.hasNewNotes &&
            <Head>
              <link rel='shortcut icon' href='/favicon-notify.png' />
            </Head>}
          <div className='position-relative'>
            <NavDropdown className='pl-0' title={`@${session.user.name}`} alignRight>
              <Link href={'/' + session.user.name} passHref>
                <NavDropdown.Item>profile</NavDropdown.Item>
              </Link>
              <Link href='/notifications' passHref>
                <NavDropdown.Item onClick={() => {
                  // when it's a fresh click evict old notification cache
                  client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'moreFlatComments:{}' })
                  client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'recentlyStacked' })
                }}
                >
                  notifications
                  {me && me.hasNewNotes &&
                    <div className='p-1 d-inline-block bg-danger ml-1'>
                      <span className='invisible'>{' '}</span>
                    </div>}
                </NavDropdown.Item>
              </Link>
              <Link href='/wallet' passHref>
                <NavDropdown.Item>wallet</NavDropdown.Item>
              </Link>
              <div>
                <NavDropdown.Divider />
                <Link href='/recent' passHref>
                  <NavDropdown.Item>recent</NavDropdown.Item>
                </Link>
                {session
                  ? (
                    <Link href='/post' passHref>
                      <NavDropdown.Item>post</NavDropdown.Item>
                    </Link>
                    )
                  : <NavDropdown.Item onClick={signIn}>post</NavDropdown.Item>}
                <NavDropdown.Item href='https://bitcoinerjobs.co' target='_blank'>jobs</NavDropdown.Item>
              </div>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={signOut}>logout</NavDropdown.Item>
            </NavDropdown>
            {me && me.hasNewNotes &&
              <span className='position-absolute p-1 bg-danger' style={{ top: '5px', right: '0px' }}>
                <span className='invisible'>{' '}</span>
              </span>}
          </div>
          {me &&
            <Nav.Item>
              <Link href='/wallet' passHref>
                <Nav.Link className='text-success px-0'><WalletSummary me={me} /></Nav.Link>
              </Link>
            </Nav.Item>}
        </div>
      )
    } else {
      return path !== '/login' && <Button id='login' href='/login' onClick={signIn}>login</Button>
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
              {session
                ? (
                  <Link href='/post' passHref>
                    <Nav.Link className={styles.navLink}>post</Nav.Link>
                  </Link>
                  )
                : <Nav.Link className={styles.navLink} onClick={signIn}>post</Nav.Link>}
            </Nav.Item>
            <Nav.Item className='d-md-flex d-none'>
              <Nav.Link href='https://bitcoinerjobs.co' target='_blank' className={styles.navLink}>jobs</Nav.Link>
            </Nav.Item>
            <Nav.Item className='text-monospace' style={{ opacity: '.5' }}>
              <Price />
            </Nav.Item>
            <Corner />
          </Nav>
        </Navbar>
      </Container>
    </>
  )
}

export function HeaderPreview () {
  return (
    <>
      <Container className='px-sm-0'>
        <Navbar className={styles.navbar}>
          <Nav className='w-100 justify-content-between flex-wrap align-items-center'>
            <Link href='/' passHref>
              <Navbar.Brand className={`${styles.brand} d-none d-sm-block`}>STACKER NEWS</Navbar.Brand>
            </Link>
            <Nav.Item className='text-monospace' style={{ opacity: '.5' }}>
              <Price />
            </Nav.Item>
          </Nav>
        </Navbar>
      </Container>
    </>
  )
}
