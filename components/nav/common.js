import Link from 'next/link'
import { Button, Dropdown, Nav, Navbar } from 'react-bootstrap'
import styles from '../header.module.css'
import { useRouter } from 'next/router'
import BackArrow from '../../svgs/arrow-left-line.svg'
import { useCallback, useEffect, useState } from 'react'
import Price from '../price'
import SubSelect from '../sub-select'
import { USER_ID, BALANCE_LIMIT_MSATS } from '../../lib/constants'
import Head from 'next/head'
import NoteIcon from '../../svgs/notification-4-fill.svg'
import { useMe } from '../me'
import HiddenWalletSummary from '../hidden-wallet-summary'
import { abbrNum, msatsToSats } from '../../lib/format'
import { useServiceWorker } from '../serviceworker'
import { signOut } from 'next-auth/react'
import Hat from '../hat'
import { randInRange } from '../../lib/rand'
import { useLightning } from '../lightning'
import LightningIcon from '../../svgs/bolt.svg'
import SearchIcon from '../../svgs/search-line.svg'
import classNames from 'classnames'
import SnIcon from '@/svgs/sn.svg'
import { useHasNewNotes } from '../use-has-new-notes'
import { useWallets } from 'wallets'

export function Brand ({ className }) {
  return (
    <Link href='/' passHref legacyBehavior>
      <Navbar.Brand className={classNames(styles.brand, className)}>
        <SnIcon width={36} height={36} />
      </Navbar.Brand>
    </Link>
  )
}

export function hasNavSelect ({ path, pathname }) {
  return (
    pathname.startsWith('/~') &&
    !path.endsWith('/post') &&
    !path.endsWith('/edit')
  )
}

export function Back () {
  const router = useRouter()
  const [back, setBack] = useState(router.asPath !== '/')

  useEffect(() => {
    setBack(router.asPath !== '/' && (typeof window.navigation === 'undefined' || window.navigation.canGoBack === undefined || window?.navigation.canGoBack))
  }, [router.asPath])

  if (!back) return null

  return (
    <a
      role='button' tabIndex='0' className='nav-link p-0 me-2' onClick={() => {
        if (back) {
          router.back()
        } else {
          router.push('/')
        }
      }}
    >
      <BackArrow className='theme me-1 me-md-2' width={24} height={24} />
    </a>
  )
}

export function BackOrBrand ({ className }) {
  const router = useRouter()
  const [back, setBack] = useState(router.asPath !== '/')

  useEffect(() => {
    setBack(router.asPath !== '/' && (typeof window.navigation === 'undefined' || window.navigation.canGoBack === undefined || window?.navigation.canGoBack))
  }, [router.asPath])

  return (
    <div className='d-flex align-items-center'>
      {back ? <Back /> : <Brand className={className} />}
    </div>
  )
}

export function SearchItem ({ prefix, className }) {
  return (
    <Link href='/search' passHref legacyBehavior>
      <Nav.Link eventKey='search' className={className}>
        <SearchIcon className='theme' width={22} height={28} />
      </Nav.Link>
    </Link>
  )
}

export function NavPrice ({ className }) {
  return (
    <Nav.Item className={classNames(styles.price, className)}>
      <Price className='nav-link text-monospace' />
    </Nav.Item>
  )
}

const PREPEND_SUBS = ['home']
const APPEND_SUBS = [{ label: '--------', items: ['create'] }]
export function NavSelect ({ sub: subName, className, size }) {
  const sub = subName || 'home'

  return (
    <Nav.Item className={className}>
      <SubSelect
        sub={sub} prependSubs={PREPEND_SUBS} appendSubs={APPEND_SUBS} noForm
        groupClassName='mb-0' size={size}
      />
    </Nav.Item>
  )
}

export function NavNotifications ({ className }) {
  const hasNewNotes = useHasNewNotes()

  return (
    <>
      <Head>
        <link rel='shortcut icon' href={hasNewNotes ? '/favicon-notify.png' : '/favicon.png'} />
      </Head>
      <Link href='/notifications' passHref legacyBehavior>
        <Nav.Link eventKey='notifications' className={classNames('position-relative', className)}>
          <NoteIcon height={28} width={20} className='theme' />
          {hasNewNotes &&
            <span className={styles.notification}>
              <span className='invisible'>{' '}</span>
            </span>}
        </Nav.Link>
      </Link>
    </>
  )
}

export function WalletSummary () {
  const me = useMe()
  if (!me) return null
  if (me.privates?.hideWalletBalance) {
    return <HiddenWalletSummary abbreviate fixedWidth />
  }
  return `${abbrNum(me.privates?.sats)}`
}

export function NavWalletSummary ({ className }) {
  const me = useMe()
  const walletLimitReached = me?.privates?.sats >= msatsToSats(BALANCE_LIMIT_MSATS)

  return (
    <Nav.Item className={className}>
      <Link href='/wallet' passHref legacyBehavior>
        <Nav.Link eventKey='wallet' className={`${walletLimitReached ? 'text-warning' : 'text-success'} text-monospace px-0 text-nowrap`}>
          <WalletSummary me={me} />
        </Nav.Link>
      </Link>
    </Nav.Item>
  )
}

export function MeDropdown ({ me, dropNavKey }) {
  if (!me) return null
  return (
    <div className='position-relative'>
      <Dropdown className={styles.dropdown} align='end'>
        <Dropdown.Toggle className='nav-link nav-item fw-normal' id='profile' variant='custom'>
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
          <LogoutDropdownItem />
        </Dropdown.Menu>
      </Dropdown>
      {!me.bioId &&
        <span className='position-absolute p-1 bg-secondary' style={{ top: '5px', right: '0px' }}>
          <span className='invisible'>{' '}</span>
        </span>}
    </div>
  )
}

export function SignUpButton ({ className = 'py-0' }) {
  const router = useRouter()
  const handleLogin = useCallback(async pathname => await router.push({
    pathname,
    query: { callbackUrl: window.location.origin + router.asPath }
  }), [router])

  return (
    <Button
      className={classNames('align-items-center ps-2 pe-3', className)}
      style={{ borderWidth: '2px', width: '112px' }}
      id='signup'
      onClick={() => handleLogin('/signup')}
    >
      <LightningIcon
        width={17}
        height={17}
        className='me-1'
      />sign up
    </Button>
  )
}

export default function LoginButton ({ className }) {
  const router = useRouter()
  const handleLogin = useCallback(async pathname => await router.push({
    pathname,
    query: { callbackUrl: window.location.origin + router.asPath }
  }), [router])

  return (
    <Button
      className='align-items-center px-3 py-1 mb-2'
      id='login'
      style={{ borderWidth: '2px', width: '112px' }}
      variant='outline-grey-darkmode'
      onClick={() => handleLogin('/login')}
    >
      login
    </Button>
  )
}

export function LogoutDropdownItem () {
  const { registration: swRegistration, togglePushSubscription } = useServiceWorker()
  const wallets = useWallets()
  return (
    <Dropdown.Item
      onClick={async () => {
        // order is important because we need to be logged in to delete push subscription on server
        const pushSubscription = await swRegistration?.pushManager.getSubscription()
        if (pushSubscription) {
          await togglePushSubscription().catch(console.error)
        }

        await wallets.resetClient().catch(console.error)

        await signOut({ callbackUrl: '/' })
      }}
    >logout
    </Dropdown.Item>
  )
}

export function LoginButtons () {
  return (
    <>
      <LoginButton />
      <SignUpButton className='py-1' />
    </>
  )
}

export function AnonDropdown ({ path }) {
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

  return (
    <div className='position-relative'>
      <Dropdown className={styles.dropdown} align='end'>
        <Dropdown.Toggle className='nav-link nav-item' id='profile' variant='custom'>
          <Nav.Link eventKey='anon' as='span' className='p-0 fw-normal'>
            @anon<Hat user={{ id: USER_ID.anon }} />
          </Nav.Link>
        </Dropdown.Toggle>
        <Dropdown.Menu className='p-3'>
          <LoginButtons />
        </Dropdown.Menu>
      </Dropdown>
    </div>
  )
}

export function Sorts ({ sub, prefix, className }) {
  return (
    <>
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
      {/* <Nav.Item className={className}>
        <Link href={prefix + '/random'} passHref legacyBehavior>
          <Nav.Link eventKey='random' className={styles.navLink}>random</Nav.Link>
        </Link>
      </Nav.Item> */}
      {sub !== 'jobs' &&
        <Nav.Item className={className}>
          <Link
            href={{
              pathname: '/~/top/[type]/[when]',
              query: { type: 'posts', when: 'day', sub }
            }} as={prefix + '/top/posts/day'} passHref legacyBehavior
          >
            <Nav.Link eventKey='top' className={styles.navLink}>top</Nav.Link>
          </Link>
        </Nav.Item>}
    </>
  )
}

export function PostItem ({ className, prefix }) {
  return (
    <Link href={prefix + '/post'} className={`${className} btn btn-md btn-primary py-md-1`}>
      post
    </Link>
  )
}

export function MeCorner ({ dropNavKey, me, className }) {
  return (
    <div className={className}>
      <NavNotifications />
      <MeDropdown me={me} dropNavKey={dropNavKey} />
      <NavWalletSummary className='d-inline-block' />
    </div>
  )
}

export function AnonCorner ({ dropNavKey, className }) {
  return (
    <div className={className}>
      <AnonDropdown dropNavKey={dropNavKey} />
    </div>
  )
}
