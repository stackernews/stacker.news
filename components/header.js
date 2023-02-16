import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import Link from 'next/link'
import styles from './header.module.css'
import { useRouter } from 'next/router'
import { Button, Container, NavDropdown } from 'react-bootstrap'
import Price from './price'
import { useMe } from './me'
import Head from 'next/head'
import { signOut } from 'next-auth/client'
import { useLightning } from './lightning'
import { useEffect, useState } from 'react'
import { randInRange } from '../lib/rand'
import { abbrNum } from '../lib/format'
import NoteIcon from '../svgs/notification-4-fill.svg'
import { useQuery, gql } from '@apollo/client'
import LightningIcon from '../svgs/bolt.svg'
import CowboyHat from './cowboy-hat'

function WalletSummary ({ me }) {
  if (!me) return null

  return `${abbrNum(me.sats)}`
}

export default function Header ({ sub }) {
  const router = useRouter()
  const path = router.asPath.split('?')[0]
  const [fired, setFired] = useState()
  const me = useMe()
  const prefix = sub ? `/~${sub}` : ''
  // there's always at least 2 on the split, e.g. '/' yields ['','']
  const topNavKey = path.split('/')[sub ? 2 : 1]
  const dropNavKey = path.split('/').slice(sub ? 2 : 1).join('/')
  const { data: subLatestPost } = useQuery(gql`
    query subLatestPost($name: ID!) {
      subLatestPost(name: $name)
    }
  `, { variables: { name: 'jobs' }, pollInterval: 600000, fetchPolicy: 'network-only' })
  const { data: hasNewNotes } = useQuery(gql`
    {
      hasNewNotes
    }
  `, { pollInterval: 30000, fetchPolicy: 'cache-and-network' })
  const [lastCheckedJobs, setLastCheckedJobs] = useState(new Date().getTime())
  useEffect(() => {
    if (me) {
      setLastCheckedJobs(me.lastCheckedJobs)
    } else {
      if (sub === 'jobs') {
        localStorage.setItem('lastCheckedJobs', new Date().getTime())
      }
      setLastCheckedJobs(localStorage.getItem('lastCheckedJobs'))
    }
  }, [sub])

  const Corner = () => {
    if (me) {
      return (
        <div className='d-flex align-items-center'>
          <Head>
            <link rel='shortcut icon' href={hasNewNotes?.hasNewNotes ? '/favicon-notify.png' : '/favicon.png'} />
          </Head>
          <Link href='/notifications' passHref>
            <Nav.Link eventKey='notifications' className='pl-0 position-relative'>
              <NoteIcon className='theme' />
              {hasNewNotes?.hasNewNotes &&
                <span className={styles.notification}>
                  <span className='invisible'>{' '}</span>
                </span>}
            </Nav.Link>
          </Link>
          <div className='position-relative'>
            <NavDropdown
              className={styles.dropdown} title={
                <Link href={`/${me?.name}`} passHref>
                  <Nav.Link eventKey={me?.name} as='div' className='p-0 d-flex align-items-center' onClick={e => e.preventDefault()}>
                    {`@${me?.name}`}<CowboyHat streak={me.streak} />
                  </Nav.Link>
                </Link>
              } alignRight
            >
              <Link href={'/' + me?.name} passHref>
                <NavDropdown.Item active={me?.name === dropNavKey}>
                  profile
                  {me && !me.bioId &&
                    <div className='p-1 d-inline-block bg-secondary ml-1'>
                      <span className='invisible'>{' '}</span>
                    </div>}
                </NavDropdown.Item>
              </Link>
              <Link href={'/' + me?.name + '/bookmarks'} passHref>
                <NavDropdown.Item active={me?.name + '/bookmarks' === dropNavKey}>bookmarks</NavDropdown.Item>
              </Link>
              <Link href='/wallet' passHref>
                <NavDropdown.Item eventKey='wallet'>wallet</NavDropdown.Item>
              </Link>
              <Link href='/satistics?inc=invoice,withdrawal,stacked,spent' passHref>
                <NavDropdown.Item eventKey='satistics'>satistics</NavDropdown.Item>
              </Link>
              <NavDropdown.Divider />
              <Link href='/referrals/month' passHref>
                <NavDropdown.Item eventKey='referrals'>referrals</NavDropdown.Item>
              </Link>
              <NavDropdown.Divider />
              <div className='d-flex align-items-center'>
                <Link href='/settings' passHref>
                  <NavDropdown.Item eventKey='settings'>settings</NavDropdown.Item>
                </Link>
              </div>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={() => signOut({ callbackUrl: '/' })}>logout</NavDropdown.Item>
            </NavDropdown>
            {me && !me.bioId &&
              <span className='position-absolute p-1 bg-secondary' style={{ top: '5px', right: '0px' }}>
                <span className='invisible'>{' '}</span>
              </span>}
          </div>
          {me &&
            <Nav.Item>
              <Link href='/wallet' passHref>
                <Nav.Link eventKey='wallet' className='text-success px-0 text-nowrap'><WalletSummary me={me} /></Nav.Link>
              </Link>
            </Nav.Item>}
        </div>
      )
    } else {
      if (!fired) {
        const strike = useLightning()
        useEffect(() => {
          let isMounted = true
          if (!localStorage.getItem('striked')) {
            setTimeout(() => {
              if (isMounted) {
                strike()
                localStorage.setItem('striked', 'yep')
                setFired(true)
              }
            }, randInRange(3000, 10000))
          }
          return () => { isMounted = false }
        }, [])
      }
      return path !== '/login' && path !== '/signup' && !path.startsWith('/invites') &&
        <div>
          <Button
            className='align-items-center px-3 py-1 mr-2'
            id='signup'
            style={{ borderWidth: '2px' }}
            variant='outline-grey-darkmode'
            onClick={async () => await router.push({ pathname: '/login', query: { callbackUrl: window.location.origin + router.asPath } })}
          >
            login
          </Button>
          <Button
            className='align-items-center pl-2 py-1 pr-3'
            style={{ borderWidth: '2px' }}
            id='login'
            onClick={async () => await router.push({ pathname: '/signup', query: { callbackUrl: window.location.origin + router.asPath } })}
          >
            <LightningIcon
              width={17}
              height={17}
              className='mr-1'
            />sign up
          </Button>
        </div>
    }
  }

  const showJobIndicator = sub !== 'jobs' && (!me || me.noteJobIndicator) &&
    (!lastCheckedJobs || lastCheckedJobs < subLatestPost?.subLatestPost)

  const NavItems = ({ className }) => {
    return (
      <>
        <Nav.Item className={className}>
          <Link href={prefix + '/recent'} passHref>
            <Nav.Link eventKey='recent' className={styles.navLink}>recent</Nav.Link>
          </Link>
        </Nav.Item>
        {!prefix &&
          <Nav.Item className={className}>
            <Link href='/top/posts/day' passHref>
              <Nav.Link eventKey='top' className={styles.navLink}>top</Nav.Link>
            </Link>
          </Nav.Item>}
        <Nav.Item className={className}>
          <div className='position-relative'>
            <Link href='/~jobs' passHref>
              <Nav.Link active={sub === 'jobs'} className={styles.navLink}>
                jobs
              </Nav.Link>
            </Link>
            {showJobIndicator &&
              <span className={styles.jobIndicator}>
                <span className='invisible'>{' '}</span>
              </span>}
          </div>
        </Nav.Item>
        {me &&
          <Nav.Item className={className}>
            <Link href={prefix + '/post'} passHref>
              <Nav.Link eventKey='post' className={styles.navLinkButton}>post</Nav.Link>
            </Link>
          </Nav.Item>}
      </>
    )
  }

  return (
    <>
      <Container className='px-sm-0'>
        <Navbar className='pb-0 pb-md-1'>
          <Nav
            className={styles.navbarNav}
            activeKey={topNavKey}
          >
            <div className='d-flex'>
              <Link href='/' passHref>
                <Navbar.Brand className={`${styles.brand} d-none d-md-block`}>
                  STACKER NEWS
                </Navbar.Brand>
              </Link>
              <Link href='/' passHref>
                <Navbar.Brand className={`${styles.brand} d-block d-md-none`}>
                  SN
                </Navbar.Brand>
              </Link>
            </div>
            <NavItems className='d-none d-md-flex' />
            <Nav.Item className={`text-monospace nav-link px-0 ${me?.name.length > 6 ? 'd-none d-lg-flex' : ''}`}>
              <Price />
            </Nav.Item>
            <Corner />
          </Nav>
        </Navbar>
        <Navbar className='pt-0 pb-1 d-md-none'>
          <Nav
            className={`${styles.navbarNav} justify-content-around`}
            activeKey={topNavKey}
          >
            <NavItems />
          </Nav>
        </Navbar>
      </Container>
    </>
  )
}

const NavItemsStatic = ({ className }) => {
  return (
    <>
      <Nav.Item className={className}>
        <Link href='/recent' passHref>
          <Nav.Link className={styles.navLink}>recent</Nav.Link>
        </Link>
      </Nav.Item>
      <Nav.Item className={className}>
        <Link href='/top/posts/day' passHref>
          <Nav.Link className={styles.navLink}>top</Nav.Link>
        </Link>
      </Nav.Item>
      <Nav.Item className={className}>
        <div className='position-relative'>
          <Link href='/~jobs' passHref>
            <Nav.Link className={styles.navLink}>
              jobs
            </Nav.Link>
          </Link>
        </div>
      </Nav.Item>
    </>
  )
}

export function HeaderStatic () {
  return (
    <Container className='px-sm-0'>
      <Navbar className='pb-0 pb-md-1'>
        <Nav
          className={styles.navbarNav}
        >
          <div className='d-flex'>
            <Link href='/' passHref>
              <Navbar.Brand className={`${styles.brand} d-none d-md-block`}>
                STACKER NEWS
              </Navbar.Brand>
            </Link>
            <Link href='/' passHref>
              <Navbar.Brand className={`${styles.brand} d-block d-md-none`}>
                SN
              </Navbar.Brand>
            </Link>
          </div>
          <NavItemsStatic className='d-none d-md-flex' />
          <Nav.Item className='text-monospace nav-link px-0'>
            <Price />
          </Nav.Item>
        </Nav>
      </Navbar>
      <Navbar className='pt-0 pb-1 d-md-none'>
        <Nav
          className={`${styles.navbarNav} justify-content-around`}
        >
          <NavItemsStatic />
        </Nav>
      </Navbar>
    </Container>
  )
}
