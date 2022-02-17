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
import { formatSats } from '../lib/format'

function WalletSummary ({ me }) {
  if (!me) return null

  return `${formatSats(me.sats)} \\ ${formatSats(me.stacked)}`
}

export default function Header ({ sub }) {
  const router = useRouter()
  const path = router.asPath.split('?')[0]
  const [fired, setFired] = useState()
  const me = useMe()
  const prefix = sub ? `/~${sub}` : ''

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
                <Link href={prefix + '/recent'} passHref>
                  <NavDropdown.Item>recent</NavDropdown.Item>
                </Link>
                {!prefix &&
                  <Link href='/top/posts/week' passHref>
                    <NavDropdown.Item>top</NavDropdown.Item>
                  </Link>}
                {me
                  ? (
                    <Link href={prefix + '/post'} passHref>
                      <NavDropdown.Item>post</NavDropdown.Item>
                    </Link>
                    )
                  : <NavDropdown.Item onClick={signIn}>post</NavDropdown.Item>}
                {sub
                  ? <Link href='/' passHref><NavDropdown.Item>home</NavDropdown.Item></Link>
                  : <Link href='/~jobs' passHref><NavDropdown.Item>~jobs</NavDropdown.Item></Link>}
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
            <div className='d-flex'>
              <Link href='/' passHref>
                <Navbar.Brand className={`${styles.brand} d-none d-sm-block`}>
                  {sub
                    ? 'SN'
                    : 'STACKER NEWS'}
                </Navbar.Brand>
              </Link>
              <Link href='/' passHref>
                <Navbar.Brand className={`${styles.brand} d-block d-sm-none`}>
                  SN
                </Navbar.Brand>
              </Link>
              {sub &&
                <Link href={prefix} passHref>
                  <Navbar.Brand className={`${styles.brand} d-block`}>
                    <span>&nbsp;</span>{sub}
                  </Navbar.Brand>
                </Link>}
            </div>
            <Nav.Item className='d-md-flex d-none'>
              <Link href={prefix + '/recent'} passHref>
                <Nav.Link className={styles.navLink}>recent</Nav.Link>
              </Link>
            </Nav.Item>
            {!prefix &&
              <Nav.Item className='d-md-flex d-none'>
                <Link href='/top/posts/week' passHref>
                  <Nav.Link className={styles.navLink}>top</Nav.Link>
                </Link>
              </Nav.Item>}
            <Nav.Item className='d-md-flex d-none'>
              {me
                ? (
                  <Link href={prefix + '/post'} passHref>
                    <Nav.Link className={styles.navLink}>post</Nav.Link>
                  </Link>
                  )
                : <Nav.Link className={styles.navLink} onClick={signIn}>post</Nav.Link>}
            </Nav.Item>
            <Nav.Item className='d-md-flex d-none'>
              {sub
                ? <Link href='/' passHref><Nav.Link className={styles.navLink}>home</Nav.Link></Link>
                : <Link href='/~jobs' passHref><Nav.Link className={styles.navLink}>~jobs</Nav.Link></Link>}
            </Nav.Item>
            <Nav.Item className='text-monospace nav-link'>
              <Price />
            </Nav.Item>
            <Corner />
          </Nav>
        </Navbar>
      </Container>
    </>
  )
}
