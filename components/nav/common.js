import Link from 'next/link'
import { Button, Dropdown, Nav, Navbar } from 'react-bootstrap'
import styles from '../header.module.css'
import { useRouter } from 'next/router'
import BackArrow from '../../svgs/arrow-left-line.svg'
import { useCallback, useEffect, useState } from 'react'
import Price from '../price'
import SubSelect from '../sub-select'
import { USER_ID } from '../../lib/constants'
import Head from 'next/head'
import NoteIcon from '../../svgs/notification-4-fill.svg'
import { useMe } from '../me'
import { abbrNum } from '../../lib/format'
import { useServiceWorker } from '../serviceworker'
import { signOut } from 'next-auth/react'
import Badges from '../badge'
import { randInRange } from '../../lib/rand'
import { useLightning } from '../lightning'
import LightningIcon from '../../svgs/bolt.svg'
import SearchIcon from '../../svgs/search-line.svg'
import classNames from 'classnames'
import SnIcon from '@/svgs/sn.svg'
import { useHasNewNotes } from '../use-has-new-notes'
// import { useWallets } from '@/wallets/client/hooks'
import { useWalletIndicator } from '@/wallets/client/hooks'
import SwitchAccountList, { nextAccount, useAccounts } from '@/components/account'
import { useShowModal } from '@/components/modal'
import { numWithUnits } from '@/lib/format'

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
  const { me } = useMe()
  if (!me || me.privates?.sats === 0) return null
  return (
    <span
      className='text-monospace'
      title={`${numWithUnits(me.privates?.credits, { abbreviate: false, unitSingular: 'CC', unitPlural: 'CCs' })}`}
    >
      {`${abbrNum(me.privates?.sats)}`}
    </span>
  )
}

export function NavWalletSummary ({ className }) {
  const { me } = useMe()

  return (
    <Nav.Item className={className}>
      <Link href='/credits' passHref legacyBehavior>
        <Nav.Link eventKey='credits' className='text-success text-monospace px-0 text-nowrap'>
          <WalletSummary me={me} />
        </Nav.Link>
      </Link>
    </Nav.Item>
  )
}

export const Indicator = ({ superscript }) => {
  if (superscript) {
    return (
      <span className='d-inline-block p-1'>
        <span
          className='position-absolute p-1 bg-secondary'
          style={{ top: '5px', right: '0px', height: '5px', width: '5px' }}
        >
          <span className='invisible'>{' '}</span>
        </span>
      </span>
    )
  }

  return (
    <div className='p-1 d-inline-block bg-secondary ms-1'>
      <span className='invisible'>{' '}</span>
    </div>
  )
}

export function MeDropdown ({ me, dropNavKey }) {
  if (!me) return null

  const profileIndicator = !me.bioId
  const walletIndicator = useWalletIndicator()
  const indicator = profileIndicator || walletIndicator

  return (
    <div className=''>
      <Dropdown className={styles.dropdown} align='end'>
        <Dropdown.Toggle className='nav-link nav-item fw-normal' id='profile' variant='custom'>
          <div className='d-flex align-items-center'>
            <Nav.Link eventKey={me.name} as='span' className='p-0 position-relative'>
              {`@${me.name}`}
              {indicator && <Indicator superscript />}
            </Nav.Link>
            <Badges user={me} />
          </div>
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Link href={'/' + me.name} passHref legacyBehavior>
            <Dropdown.Item active={me.name === dropNavKey}>
              profile
              {profileIndicator && <Indicator />}
            </Dropdown.Item>
          </Link>
          <Link href={'/' + me.name + '/bookmarks'} passHref legacyBehavior>
            <Dropdown.Item active={me.name + '/bookmarks' === dropNavKey}>bookmarks</Dropdown.Item>
          </Link>
          <Link href='/wallets' passHref legacyBehavior>
            <Dropdown.Item eventKey='wallets'>
              wallets
              {walletIndicator && <Indicator />}
            </Dropdown.Item>
          </Link>
          <Link href='/credits' passHref legacyBehavior>
            <Dropdown.Item eventKey='credits'>credits</Dropdown.Item>
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
    </div>
  )
}

// this is the width of the 'switch account' button if no width is given
const SWITCH_ACCOUNT_BUTTON_WIDTH = '162px'

export function SignUpButton ({ className = 'py-0', width }) {
  const router = useRouter()
  const handleLogin = useCallback(async pathname => await router.push({
    pathname,
    query: { callbackUrl: window.location.origin + router.asPath }
  }), [router])

  return (
    <Button
      className={classNames('align-items-center ps-2 pe-3', className)}
      // 161px is the width of the 'switch account' button
      style={{ borderWidth: '2px', width: width || SWITCH_ACCOUNT_BUTTON_WIDTH }}
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

export default function LoginButton () {
  const router = useRouter()
  const handleLogin = useCallback(async pathname => await router.push({
    pathname,
    query: { callbackUrl: window.location.origin + router.asPath }
  }), [router])

  return (
    <Button
      className='align-items-center px-3 py-1'
      id='login'
      style={{ borderWidth: '2px', width: SWITCH_ACCOUNT_BUTTON_WIDTH }}
      variant='outline-grey-darkmode'
      onClick={() => handleLogin('/login')}
    >
      login
    </Button>
  )
}

function LogoutObstacle ({ onClose }) {
  const { registration: swRegistration, togglePushSubscription } = useServiceWorker()
  // const { removeLocalWallets } = useWallets()
  const router = useRouter()

  return (
    <div className='d-flex m-auto flex-column w-fit-content'>
      <h4 className='mb-3'>I reckon you want to logout?</h4>
      <div className='mt-2 d-flex justify-content-between'>
        <Button
          className='me-2'
          variant='grey-medium'
          onClick={onClose}
        >
          cancel
        </Button>
        <Button
          onClick={async () => {
            const next = await nextAccount()
            // only signout if we did not find a next account
            if (next) {
              onClose()
              // reload whatever page we're on to avoid any bugs
              router.reload()
              return
            }

            // order is important because we need to be logged in to delete push subscription on server
            const pushSubscription = await swRegistration?.pushManager.getSubscription()
            if (pushSubscription) {
              await togglePushSubscription().catch(console.error)
            }

            // TODO(wallet-v2): implement this
            // removeLocalWallets()

            await signOut({ callbackUrl: '/' })
          }}
        >
          logout
        </Button>
      </div>
    </div>
  )
}

export function LogoutDropdownItem ({ handleClose }) {
  const showModal = useShowModal()

  return (
    <>
      <Dropdown.Item onClick={() => {
        handleClose?.()
        showModal(onClose => <SwitchAccountList onClose={onClose} />)
      }}
      >switch account
      </Dropdown.Item>
      <Dropdown.Item
        onClick={async () => {
          handleClose?.()
          showModal(onClose => (<LogoutObstacle onClose={onClose} />))
        }}
      >logout
      </Dropdown.Item>
    </>
  )
}

function SwitchAccountButton ({ handleClose }) {
  const showModal = useShowModal()
  const accounts = useAccounts()

  if (accounts.length === 0) return null

  return (
    <Button
      className='align-items-center px-3 py-1'
      variant='outline-grey-darkmode'
      style={{ borderWidth: '2px', width: SWITCH_ACCOUNT_BUTTON_WIDTH }}
      onClick={() => {
        // login buttons rendered in offcanvas aren't wrapped inside <Dropdown>
        // so we manually close the offcanvas in that case by passing down handleClose here
        handleClose?.()
        showModal(onClose => <SwitchAccountList onClose={onClose} />)
      }}
    >
      switch account
    </Button>
  )
}

export function LoginButtons ({ handleClose }) {
  return (
    <>
      <Dropdown.Item className='py-1'>
        <LoginButton />
      </Dropdown.Item>
      <Dropdown.Item className='py-1'>
        <SignUpButton className='py-1' />
      </Dropdown.Item>
      <Dropdown.Item className='py-1'>
        <SwitchAccountButton handleClose={handleClose} />
      </Dropdown.Item>
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
      <Dropdown className={styles.dropdown} align='end' autoClose>
        <Dropdown.Toggle className='nav-link nav-item' id='profile' variant='custom'>
          <Nav.Link eventKey='anon' as='span' className='p-0 fw-normal'>
            @anon<Badges user={{ id: USER_ID.anon }} />
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
      {sub !== 'jobs' &&
        <>
          <Nav.Item className={className}>
            <Link href={prefix + '/random'} passHref legacyBehavior>
              <Nav.Link eventKey='random' className={styles.navLink}>random</Nav.Link>
            </Link>
          </Nav.Item>
          <Nav.Item className={className}>
            <Link
              href={{
                pathname: '/~/top/[type]/[when]',
                query: { type: 'posts', when: 'day', sub }
              }} as={prefix + '/top/posts/day'} passHref legacyBehavior
            >
              <Nav.Link eventKey='top' className={styles.navLink}>top</Nav.Link>
            </Link>
          </Nav.Item>
        </>}
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
