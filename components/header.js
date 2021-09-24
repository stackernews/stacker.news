import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import Link from 'next/link'
import styles from './header.module.css'
import { useRouter } from 'next/router'
import { Button, Container, NavDropdown } from 'react-bootstrap'
import Price from './price'
import { useMe } from './me'
import Head from 'next/head'
import { signOut, signIn, useSession } from 'next-auth/client'
import { useLightning } from './lightning'
import { useEffect } from 'react'
import { randInRange } from '../lib/rand'

function WalletSummary ({ me }) {
  return `${me.sats} \\ ${me.stacked}`
}

function RefreshableLink ({ href, children, ...props }) {
  const router = useRouter()
  const same = router.asPath === href
  return (
    <Link href={same ? `${href}?key=${Math.random()}` : href} as={href} {...props}>
      {children}
    </Link>
  )
}

export default function Header () {
  const router = useRouter()
  const path = router.asPath.split('?')[0]
  const me = useMe()
  const [session, loading] = useSession()

  const Corner = () => {
    if (loading || !me) {
      return null
    }

    if (session) {
      return (
        <div className='d-flex align-items-center'>
          <Head>
            <link rel='shortcut icon' href={me?.hasNewNotes ? '/favicon-notify.png' : '/favicon.png'} />
          </Head>
          <div className='position-relative mr-1'>
            <NavDropdown className='px-0' title={`@${me.name}`} alignRight>
              <Link href={'/' + me.name} passHref>
                <NavDropdown.Item>
                  profile
                  {me && !me.bio &&
                    <div className='p-1 d-inline-block bg-secondary ml-1'>
                      <span className='invisible'>{' '}</span>
                    </div>}
                </NavDropdown.Item>
              </Link>
              <RefreshableLink href='/notifications' passHref>
                <NavDropdown.Item>
                  notifications
                  {me?.hasNewNotes &&
                    <div className='p-1 d-inline-block bg-danger ml-1'>
                      <span className='invisible'>{' '}</span>
                    </div>}
                </NavDropdown.Item>
              </RefreshableLink>
              <Link href='/wallet' passHref>
                <NavDropdown.Item>wallet</NavDropdown.Item>
              </Link>
              <div>
                <NavDropdown.Divider />
                <RefreshableLink href='/recent' passHref>
                  <NavDropdown.Item>recent</NavDropdown.Item>
                </RefreshableLink>
                {me
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
            {me?.hasNewNotes &&
              <span className='position-absolute p-1 bg-danger' style={{ top: '5px', right: '0px' }}>
                <span className='invisible'>{' '}</span>
              </span>}
            {me && !me.bio &&
              <span className='position-absolute p-1 bg-secondary' style={{ bottom: '5px', right: '0px' }}>
                <span className='invisible'>{' '}</span>
              </span>}
          </div>
          {me &&
            <Nav.Item>
              <Link href='/wallet' passHref>
                <Nav.Link className='text-success px-0 text-nowrap'><WalletSummary me={me} /></Nav.Link>
              </Link>
            </Nav.Item>}
        </div>
      )
    } else {
      const strike = useLightning()
      useEffect(() => {
        setTimeout(strike, randInRange(3000, 10000))
      }, [router.asPath])
      return path !== '/login' && <Button id='login' onClick={signIn}>login</Button>
    }
  }

  return (
    <>
      <Container className='px-sm-0'>
        <Navbar className={styles.navbar}>
          <Nav className='w-100 justify-content-between flex-wrap align-items-center' activeKey={path}>
            <RefreshableLink href='/' passHref>
              <Navbar.Brand className={`${styles.brand} d-none d-sm-block`}>STACKER NEWS</Navbar.Brand>
            </RefreshableLink>
            <RefreshableLink href='/' passHref>
              <Navbar.Brand className={`${styles.brand} d-block d-sm-none`}>SN</Navbar.Brand>
            </RefreshableLink>
            <Nav.Item className='d-md-flex d-none'>
              <RefreshableLink href='/recent' passHref>
                <Nav.Link className={styles.navLink}>recent</Nav.Link>
              </RefreshableLink>
            </Nav.Item>
            <Nav.Item className='d-md-flex d-none'>
              {me
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
