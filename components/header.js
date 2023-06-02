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
import { Form, Select } from './form'
import SearchIcon from '../svgs/search-line.svg'
import BackArrow from '../svgs/arrow-left-line.svg'
import { useNotification } from './notifications'

function WalletSummary ({ me }) {
  if (!me) return null

  return `${abbrNum(me.sats)}`
}

function Back () {
  const router = useRouter()
  if (typeof window !== 'undefined' && (typeof window.navigation === 'undefined' || window.navigation.canGoBack === undefined || window?.navigation.canGoBack)) {
    return <BackArrow className='theme standalone mr-1 mr-md-2' width={22} height={22} onClick={() => router.back()} />
  }
  return null
}

export default function Header ({ sub }) {
  const router = useRouter()
  const [fired, setFired] = useState()
  const [topNavKey, setTopNavKey] = useState('')
  const [dropNavKey, setDropNavKey] = useState('')
  const [prefix, setPrefix] = useState('')
  const [path, setPath] = useState('')
  const me = useMe()
  const notification = useNotification()

  useEffect(() => {
    // there's always at least 2 on the split, e.g. '/' yields ['','']
    const path = router.asPath.split('?')[0]
    setPrefix(sub ? `/~${sub}` : '')
    setTopNavKey(path.split('/')[sub ? 2 : 1] ?? '')
    setDropNavKey(path.split('/').slice(sub ? 2 : 1).join('/'))
    setPath(path)
  }, [sub, router.asPath])

  // const { data: subLatestPost } = useQuery(gql`
  //   query subLatestPost($name: ID!) {
  //     subLatestPost(name: $name)
  //   }
  // `, { variables: { name: 'jobs' }, pollInterval: 600000, fetchPolicy: 'network-only' })
  const { data: hasNewNotes } = useQuery(gql`
    {
      hasNewNotes
    }
  `, {
    pollInterval: 30000,
    fetchPolicy: 'cache-and-network',
    // Trigger onComplete after every poll
    // See https://github.com/apollographql/apollo-client/issues/5531#issuecomment-568235629
    notifyOnNetworkStatusChange: true,
    onCompleted: (data) => {
      const notified = JSON.parse(localStorage.getItem('notified')) || false
      if (!notified && data.hasNewNotes) {
        notification.show('you have Stacker News notifications')
      }
      localStorage.setItem('notified', data.hasNewNotes)
    }
  })
  // const [lastCheckedJobs, setLastCheckedJobs] = useState(new Date().getTime())
  // useEffect(() => {
  //   if (me) {
  //     setLastCheckedJobs(me.lastCheckedJobs)
  //   } else {
  //     if (sub === 'jobs') {
  //       localStorage.setItem('lastCheckedJobs', new Date().getTime())
  //     }
  //     setLastCheckedJobs(localStorage.getItem('lastCheckedJobs'))
  //   }
  // }, [sub])

  const Corner = () => {
    if (me) {
      return (
        <div className='d-flex align-items-center ml-auto'>
          <Head>
            <link rel='shortcut icon' href={hasNewNotes?.hasNewNotes ? '/favicon-notify.png' : '/favicon.png'} />
          </Head>
          <Link href='/notifications' passHref>
            <Nav.Link eventKey='notifications' className='pl-0 position-relative'>
              <NoteIcon height={22} width={22} className='theme' />
              {hasNewNotes?.hasNewNotes &&
                <span className={styles.notification}>
                  <span className='invisible'>{' '}</span>
                </span>}
            </Nav.Link>
          </Link>
          <div className='position-relative'>
            <NavDropdown
              className={styles.dropdown} title={
                <Nav.Link eventKey={me?.name} as='span' className='p-0 d-flex align-items-center' onClick={e => e.preventDefault()}>
                  {`@${me?.name}`}<CowboyHat user={me} />
                </Nav.Link>
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
        <div className='ml-auto'>
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

  // const showJobIndicator = sub !== 'jobs' && (!me || me.noteJobIndicator) &&
  //   (!lastCheckedJobs || lastCheckedJobs < subLatestPost?.subLatestPost)

  const NavItems = ({ className }) => {
    return (
      <>
        <Nav.Item className={className}>
          <Form
            initial={{
              sub: sub || 'home'
            }}
          >
            <Select
              groupClassName='mb-0'
              onChange={(formik, e) => router.push(e.target.value === 'home' ? '/' : `/~${e.target.value}`)}
              name='sub'
              size='sm'
              items={['home', 'bitcoin', 'nostr', 'jobs']}
            />
          </Form>
        </Nav.Item>
        <Nav.Item className={className}>
          <Link href={prefix + '/'} passHref>
            <Nav.Link eventKey='' className={styles.navLink}>hot</Nav.Link>
          </Link>
        </Nav.Item>
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
        {/* <Nav.Item className={className}>
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
        </Nav.Item> */}
        {/* <Nav.Item className={`text-monospace nav-link mx-auto px-0 ${me?.name.length > 6 ? 'd-none d-lg-flex' : ''}`}>
          <Price />
        </Nav.Item> */}
      </>
    )
  }

  const PostItem = ({ className }) => {
    return me
      ? (
        <Nav.Link eventKey='post' className={`${className}`}>
          <Link href={prefix + '/post'} passHref>
            <button className='btn btn-md btn-primary px-3 py-1'>post</button>
          </Link>
        </Nav.Link>)
      : null
  }

  return (
    <>
      <Container className='px-0'>
        <Navbar className='pb-0 pb-lg-2'>
          <Nav
            className={styles.navbarNav}
            activeKey={topNavKey}
          >
            <div className='d-flex align-items-center'>
              <Back />
              <Link href='/' passHref>
                <Navbar.Brand className={`${styles.brand} d-flex`}>
                  SN
                </Navbar.Brand>
              </Link>
            </div>
            <NavItems className='d-none d-lg-flex mx-2' />
            <PostItem className='d-none d-lg-flex mx-2' />
            <Link href='/search' passHref>
              <Nav.Link eventKey='search' className='position-relative d-none d-lg-flex align-items-center pr-0 ml-2'>
                <SearchIcon className='theme' width={22} height={22} />
              </Nav.Link>
            </Link>
            <Nav.Item className={`${styles.price} ml-auto align-items-center ${me?.name.length > 10 ? 'd-none d-lg-flex' : ''}`}>
              <Price className='nav-link text-monospace' />
            </Nav.Item>
            <Corner />
          </Nav>
        </Navbar>
        <Navbar className='pt-0 pb-2 d-lg-none'>
          <Nav
            className={`${styles.navbarNav}`}
            activeKey={topNavKey}
          >
            <NavItems className='mr-1' />
            <Link href='/search' passHref>
              <Nav.Link eventKey='search' className='position-relative ml-auto d-flex mr-1'>
                <SearchIcon className='theme' width={22} height={22} />
              </Nav.Link>
            </Link>
            <PostItem className='mr-0 pr-0' />
          </Nav>
        </Navbar>
      </Container>
    </>
  )
}

export function HeaderStatic () {
  return (
    <Container className='px-sm-0'>
      <Navbar className='pb-0 pb-lg-1'>
        <Nav
          className={styles.navbarNav}
        >
          <div className='d-flex align-items-center'>
            <Back />
            <Link href='/' passHref>
              <Navbar.Brand className={`${styles.brand}`}>
                SN
              </Navbar.Brand>
            </Link>

            <Link href='/search' passHref>
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
