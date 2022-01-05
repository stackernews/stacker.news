import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import Link from 'next/link'
import styles from './header.module.css'
import { useRouter } from 'next/router'
import { Button, Container, NavDropdown } from 'react-bootstrap'
import Price from './price'
import { useMe } from './me'
import Head from 'next/head'
import { signOut, signIn } from 'next-auth/client'
import { useLightning } from './lightning'
import { useEffect, useState } from 'react'
import { randInRange } from '../lib/rand'

const formatSats = n => {
  if (n < 1e4) return n
  if (n >= 1e4 && n < 1e6) return +(n / 1e3).toFixed(1) + 'k'
  if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(1) + 'm'
  if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(1) + 'b'
  if (n >= 1e12) return +(n / 1e12).toFixed(1) + 't'
}

function WalletSummary ({ me }) {
  if (!me) return null

  return `${formatSats(me.sats)} \\ ${formatSats(me.stacked)}`
}

export default function Header () {
  const router = useRouter()
  const path = router.asPath.split('?')[0]
  const [fired, setFired] = useState()
  const me = useMe()

  const Corner = () => {
    if (me) {
      return (
        <div className='d-flex align-items-center'>
          <Head>
            <link rel='shortcut icon' href={me?.hasNewNotes ? '/favicon-notify.png' : '/favicon.png'} />
          </Head>
          <div className='position-relative'>
            <NavDropdown className='px-0' title={`@${me?.name}`} alignRight>
              <Link href={'/' + me?.name} passHref>
                <NavDropdown.Item>
                  profile
                  {me && !me.bio &&
                    <div className='p-1 d-inline-block bg-secondary ml-1'>
                      <span className='invisible'>{' '}</span>
                    </div>}
                </NavDropdown.Item>
              </Link>
              <Link href='/notifications' passHref>
                <NavDropdown.Item>
                  notifications
                  {me?.hasNewNotes &&
                    <div className='p-1 d-inline-block bg-danger ml-1'>
                      <span className='invisible'>{' '}</span>
                    </div>}
                </NavDropdown.Item>
              </Link>
              <Link href='/wallet' passHref>
                <NavDropdown.Item>wallet</NavDropdown.Item>
              </Link>
              <NavDropdown.Divider />
              <Link href='/invites' passHref>
                <NavDropdown.Item>invites
                  {me && !me.hasInvites &&
                    <div className='p-1 d-inline-block bg-success ml-1'>
                      <span className='invisible'>{' '}</span>
                    </div>}
                </NavDropdown.Item>
              </Link>
              <div>
                <NavDropdown.Divider />
                <Link href='/recent' passHref>
                  <NavDropdown.Item>recent</NavDropdown.Item>
                </Link>
                <Link href='/top/posts/week' passHref>
                  <NavDropdown.Item>top</NavDropdown.Item>
                </Link>
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
              <div className='d-flex align-items-center'>
                <Link href='/settings' passHref>
                  <NavDropdown.Item>settings</NavDropdown.Item>
                </Link>
              </div>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={() => signOut({ callbackUrl: '/' })}>logout</NavDropdown.Item>
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
      if (!fired) {
        const strike = useLightning()
        useEffect(() => {
          setTimeout(strike, randInRange(3000, 10000))
          setFired(true)
        }, [router.asPath])
      }
      return path !== '/login' && !path.startsWith('/invites') && <Button id='login' onClick={signIn}>login</Button>
    }
  }

  return (
    <>
      <Container className='px-sm-0'>
        <Navbar className='pb-1'>
          <Nav
            className={styles.navbarNav}
            activeKey={path}
          >
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
              <Link href='/top/posts/week' passHref>
                <Nav.Link className={styles.navLink}>top</Nav.Link>
              </Link>
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
        {/* still need to set variant */}
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
