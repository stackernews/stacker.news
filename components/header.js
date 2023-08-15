import Dropdown from 'react-bootstrap/Dropdown'
import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import Link from 'next/link'
import styles from './header.module.css'
import { useRouter } from 'next/router'
import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/Container'
import Price from './price'
import { useMe } from './me'
import Head from 'next/head'
import { signOut } from 'next-auth/react'
import { useCallback, useEffect } from 'react'
import { randInRange } from '../lib/rand'
import { abbrNum } from '../lib/format'
import NoteIcon from '../svgs/notification-4-fill.svg'
import { useQuery } from '@apollo/client'
import LightningIcon from '../svgs/bolt.svg'
import { Select } from './form'
import SearchIcon from '../svgs/search-line.svg'
import BackArrow from '../svgs/arrow-left-line.svg'
import { SSR, SUBS } from '../lib/constants'
import { useLightning } from './lightning'
import { HAS_NOTIFICATIONS } from '../fragments/notifications'
import AnonIcon from '../svgs/spy-fill.svg'
import Hat from './hat'

function WalletSummary ({ me }) {
  if (!me) return null
  return `${abbrNum(me.sats)}`
}

function Back () {
  const router = useRouter()

  return router.asPath !== '/' &&
    <a
      role='button' tabIndex='0' className='nav-link standalone p-0' onClick={() => {
        if (typeof window.navigation === 'undefined' || window.navigation.canGoBack === undefined || window?.navigation.canGoBack) {
          router.back()
        } else {
          router.push('/')
        }
      }}
    >
      <BackArrow className='theme me-1 me-md-2' width={22} height={22} />
    </a>
}

function NotificationBell () {
  const { data } = useQuery(HAS_NOTIFICATIONS, SSR
    ? {}
    : {
        pollInterval: 30000,
        nextFetchPolicy: 'cache-and-network'
      })

  return (
    <>
      <Head>
        <link rel='shortcut icon' href={data?.hasNewNotes ? '/favicon-notify.png' : '/favicon.png'} />
      </Head>
      <Link href='/notifications' passHref legacyBehavior>
        <Nav.Link eventKey='notifications' className='ps-0 position-relative'>
          <NoteIcon height={22} width={22} className='theme' style={{ marginTop: '-4px' }} />
          {data?.hasNewNotes &&
            <span className={styles.notification}>
              <span className='invisible'>{' '}</span>
            </span>}
        </Nav.Link>
      </Link>
    </>
  )
}

function NavProfileMenu ({ me, dropNavKey }) {
  return (
    <div className='position-relative'>
      <Dropdown className={styles.dropdown} align='end'>
        <Dropdown.Toggle className='nav-link nav-item' id='profile' variant='custom'>
          <Nav.Link eventKey={me.name} as='span' className='p-0'>
            {`@${me.name}`}<Hat user={me} />
          </Nav.Link>
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Link href={'/' + me.name} passHref legacyBehavior>
            <Dropdown.Item active={me.name === dropNavKey}>
              profile
              {me && !me.bioId &&
                <div className='p-1 d-inline-block bg-secondary ms-1'>
                  <span className='invisible'>{' '}</span>
                </div>}
            </Dropdown.Item>
          </Link>
          <Link href={'/' + me.name + '/bookmarks'} passHref legacyBehavior>
            <Dropdown.Item active={me.name + '/bookmarks' === dropNavKey}>bookmarks</Dropdown.Item>
          </Link>
          <Link href='/wallet' passHref legacyBehavior>
            <Dropdown.Item eventKey='wallet'>wallet</Dropdown.Item>
          </Link>
          <Link href='/satistics?inc=invoice,withdrawal,stacked,spent' passHref legacyBehavior>
            <Dropdown.Item eventKey='satistics'>satistics</Dropdown.Item>
          </Link>
          <Dropdown.Divider />
          <Link href='/referrals/month' passHref legacyBehavior>
            <Dropdown.Item eventKey='referrals'>referrals</Dropdown.Item>
          </Link>
          <Dropdown.Divider />
          <div className='d-flex align-items-center'>
            <Link href='/settings' passHref legacyBehavior>
              <Dropdown.Item eventKey='settings'>settings</Dropdown.Item>
            </Link>
          </div>
          <Dropdown.Divider />
          <Dropdown.Item onClick={() => signOut({ callbackUrl: '/' })}>logout</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      {!me.bioId &&
        <span className='position-absolute p-1 bg-secondary' style={{ top: '5px', right: '0px' }}>
          <span className='invisible'>{' '}</span>
        </span>}
    </div>
  )
}

function StackerCorner ({ dropNavKey }) {
  const me = useMe()

  return (
    <div className='d-flex ms-auto'>
      <NotificationBell />
      <NavProfileMenu me={me} dropNavKey={dropNavKey} />
      <Nav.Item>
        <Link href='/wallet' passHref legacyBehavior>
          <Nav.Link eventKey='wallet' className='text-success px-0 text-nowrap'><WalletSummary me={me} /></Nav.Link>
        </Link>
      </Nav.Item>
    </div>
  )
}

function LurkerCorner ({ path }) {
  const router = useRouter()
  const strike = useLightning()

  useEffect(() => {
    if (!window.localStorage.getItem('striked')) {
      const to = setTimeout(() => {
        strike()
        window.localStorage.setItem('striked', 'yep')
      }, randInRange(3000, 10000))
      return () => clearTimeout(to)
    }
  }, [])

  const handleLogin = useCallback(async pathname => await router.push({
    pathname,
    query: { callbackUrl: window.location.origin + router.asPath }
  }), [router])

  return path !== '/login' && path !== '/signup' && !path.startsWith('/invites') &&
    <div className='ms-auto'>
      <Button
        className='align-items-center px-3 py-1 me-2'
        id='signup'
        style={{ borderWidth: '2px' }}
        variant='outline-grey-darkmode'
        onClick={() => handleLogin('/login')}
      >
        login
      </Button>
      <Button
        className='align-items-center ps-2 py-1 pe-3'
        style={{ borderWidth: '2px' }}
        id='login'
        onClick={() => handleLogin('/signup')}
      >
        <LightningIcon
          width={17}
          height={17}
          className='me-1'
        />sign up
      </Button>
    </div>
}

function NavItems ({ className, sub, prefix }) {
  const router = useRouter()
  sub ||= 'home'

  return (
    <>
      <Nav.Item className={className}>
        <Select
          groupClassName='mb-0'
          onChange={(_, e) => router.push(e.target.value === 'home' ? '/' : `/~${e.target.value}`)}
          name='sub'
          size='sm'
          value={sub}
          noForm
          items={['home', ...SUBS]}
        />
      </Nav.Item>
      <Nav.Item className={className}>
        <Link href={prefix + '/'} passHref legacyBehavior>
          <Nav.Link eventKey='' className={styles.navLink}>hot</Nav.Link>
        </Link>
      </Nav.Item>
      <Nav.Item className={className}>
        <Link href={prefix + '/recent'} passHref legacyBehavior>
          <Nav.Link eventKey='recent' className={styles.navLink}>recent</Nav.Link>
        </Link>
      </Nav.Item>
      {sub !== 'jobs' &&
        <Nav.Item className={className}>
          <Link href={prefix + '/top/posts/day'} passHref legacyBehavior>
            <Nav.Link eventKey='top' className={styles.navLink}>top</Nav.Link>
          </Link>
        </Nav.Item>}
    </>
  )
}

function PostItem ({ className, prefix }) {
  const me = useMe()

  if (me) {
    return (
      <Link href={prefix + '/post'} className={`${className} btn btn-md btn-primary px-3 py-1 `}>
        post
      </Link>
    )
  }

  return (
    <Link
      href={prefix + '/post'}
      className={`${className} ${styles.postAnon} btn btn-md btn-outline-grey-darkmode d-flex align-items-center px-3 py-0 py-lg-1`}
    >
      <AnonIcon className='me-1 fill-secondary' width={16} height={16} /> post
    </Link>
  )
}

export default function Header ({ sub }) {
  const router = useRouter()
  const path = router.asPath.split('?')[0]
  const prefix = sub ? `/~${sub}` : ''
  const topNavKey = path.split('/')[sub ? 2 : 1] ?? ''
  const dropNavKey = path.split('/').slice(sub ? 2 : 1).join('/')
  const me = useMe()

  return (
    <Container as='header' className='px-sm-0'>
      <Navbar className='pb-0 pb-lg-2'>
        <Nav
          className={styles.navbarNav}
          activeKey={topNavKey}
        >
          <div className='d-flex align-items-center'>
            <Back />
            <Link href='/' passHref legacyBehavior>
              <Navbar.Brand className={`${styles.brand} d-flex me-0 me-md-2`}>
                SN
              </Navbar.Brand>
            </Link>
          </div>
          <NavItems className='d-none d-lg-flex mx-2' prefix={prefix} sub={sub} />
          <PostItem className='d-none d-lg-flex mx-2' prefix={prefix} />
          <Link href={prefix + '/search'} passHref legacyBehavior>
            <Nav.Link eventKey='search' className='position-relative d-none d-lg-flex align-items-center pe-0 ms-2'>
              <SearchIcon className='theme' width={22} height={22} />
            </Nav.Link>
          </Link>
          <Nav.Item className={`${styles.price} ms-auto align-items-center ${me?.name.length > 10 ? 'd-none d-lg-flex' : ''}`}>
            <Price className='nav-link text-monospace' />
          </Nav.Item>
          {me ? <StackerCorner dropNavKey={dropNavKey} /> : <LurkerCorner path={path} />}
        </Nav>
      </Navbar>
      <Navbar className='pt-0 pb-2 d-lg-none'>
        <Nav
          className={styles.navbarNav}
          activeKey={topNavKey}
        >
          <NavItems className='me-1' prefix={prefix} sub={sub} />
          <Link href={prefix + '/search'} passHref legacyBehavior>
            <Nav.Link eventKey='search' className='position-relative ms-auto d-flex me-1'>
              <SearchIcon className='theme' width={22} height={22} />
            </Nav.Link>
          </Link>
          <PostItem className='me-0' prefix={prefix} />
        </Nav>
      </Navbar>
    </Container>
  )
}

export function HeaderStatic () {
  return (
    <Container as='header' className='px-sm-0'>
      <Navbar className='pb-0 pb-lg-1'>
        <Nav
          className={styles.navbarNav}
        >
          <div className='d-flex align-items-center'>
            <Back />
            <Link href='/' passHref legacyBehavior>
              <Navbar.Brand className={styles.brand}>
                SN
              </Navbar.Brand>
            </Link>

            <Link href='/search' passHref legacyBehavior>
              <Nav.Link eventKey='search' className='position-relative d-flex align-items-center mx-2'>
                <SearchIcon className='theme' width={22} height={22} />
              </Nav.Link>
            </Link>
          </div>
        </Nav>
      </Navbar>
    </Container>
  )
}
