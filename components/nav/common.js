import Link from 'next/link'
import Nav, { navLinkClasses } from '@/components/ui/nav'
import Button, { buttonClasses } from '@/components/ui/button'
import Menu from '@/components/ui/menu'
import styles from '../header.module.css'
import { useRouter } from 'next/router'
import BackArrow from '../../svgs/arrow-left-line.svg'
import { useCallback, useEffect, useState } from 'react'
import Price from '../price'
import SubSelect from '../sub-select'
import { PUBLIC_MEDIA_URL, USER_ID } from '../../lib/constants'
import NoteIcon from '../../svgs/notification-4-fill.svg'
import { useMe } from '../me'
import { abbrNum } from '../../lib/format'
import { useServiceWorker } from '../serviceworker'
import { signOut } from 'next-auth/react'
import Badges from '../badge'
import LightningIcon from '../../svgs/bolt.svg'
import SearchIcon from '../../svgs/search-line.svg'
import classNames from 'classnames'
import SnIcon from '@/svgs/sn.svg'
import { useHasNewNotes } from '../use-has-new-notes'
import { useWalletIndicator } from '@/wallets/client/hooks'
import SwitchAccountList, { nextAccount, useAccounts, useIsLurker } from '@/components/account'
import { useShowModal } from '@/components/modal'
import { ObstacleButtons } from '@/components/obstacle'
import { numWithUnits } from '@/lib/format'
import { useBranding } from '@/components/territory-branding'

export function Brand ({ className }) {
  const branding = useBranding()
  const logoUrl = branding?.logoId ? `${PUBLIC_MEDIA_URL}/${branding.logoId}` : null

  return (
    <Link href='/' className={classNames(styles.brand, className)}>
      {logoUrl
        ? <img src={logoUrl} alt='site logo' width={36} height={36} className={styles.brandImage} loading='eager' decoding='async' />
        : <SnIcon width={36} height={36} />}
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
    <button
      type='button'
      className={navLinkClasses({ className: 'bg-transparent border-0 p-0 me-2' })}
      onClick={() => {
        if (back) {
          router.back()
        } else {
          router.push('/')
        }
      }}
    >
      <BackArrow className='theme me-1 md:me-2' width={24} height={24} />
    </button>
  )
}

export function BackOrBrand ({ className }) {
  const router = useRouter()
  const [back, setBack] = useState(router.asPath !== '/')

  useEffect(() => {
    setBack(router.asPath !== '/' && (typeof window.navigation === 'undefined' || window.navigation.canGoBack === undefined || window?.navigation.canGoBack))
  }, [router.asPath])

  return (
    <div className='flex items-center'>
      {back ? <Back /> : <Brand className={className} />}
    </div>
  )
}

export function SearchItem ({ className }) {
  return (
    <Nav.Link href='/search' eventKey='search' className={classNames('py-0.5 px-2', className)}>
      <SearchIcon className='theme' width={22} height={28} />
    </Nav.Link>
  )
}

export function NavPrice ({ className }) {
  return (
    <Nav.Item className={classNames(styles.price, className)}>
      <Price className={navLinkClasses({ className: 'py-0.5 px-2 font-mono' })} />
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
      <Nav.Link href='/notifications' eventKey='notifications' className={classNames('py-0.5 px-2', className)}>
        <Indicator show={hasNewNotes} top='2px' right='0px' variant='danger'>
          <NoteIcon height={28} width={20} className='theme' />
        </Indicator>
      </Nav.Link>
    </>
  )
}

export function WalletSummary () {
  const { me } = useMe()
  if (!me || me.privates?.sats === 0) return null
  return (
    <span
      className='font-mono'
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
      <Nav.Link href='/wallets' eventKey='wallets' className='text-success font-mono py-0.5 px-0 whitespace-nowrap'>
        <WalletSummary me={me} />
      </Nav.Link>
    </Nav.Item>
  )
}

export const Indicator = ({ show, top = '0px', right = '0px', variant = 'secondary', children }) => {
  return (
    <div className='w-fit relative'>
      {children}
      {show && (
        <span
          className={`absolute p-1 ${variant === 'danger' ? 'bg-danger' : 'bg-secondary'}`}
          style={{ top, right, height: '5px', width: '5px', border: '1px solid var(--bs-body-bg)' }}
        >
          <span className='invisible'>{' '}</span>
        </span>
      )}
    </div>
  )
}

export function MeDropdown ({ me, dropNavKey }) {
  const walletIndicator = useWalletIndicator()
  if (!me) return null

  const profileIndicator = !me.bioId
  const indicator = profileIndicator || walletIndicator
  // topNavKey equals dropNavKey.split('/')[0] by construction, useNavKeys
  // derives both from the same path offset
  const topKey = dropNavKey?.split('/')[0]

  return (
    <div className='ms-2'>
      <Menu className={styles.dropdown}>
        <Menu.Trigger className={navLinkClasses({ className: 'font-normal ps-0 pe-2 py-0.5' })}>
          <div className='flex items-center'>
            {/* never interactive, the Menu.Trigger owns the semantics; active
                resolves from topKey */}
            <span className={navLinkClasses({ active: topKey === me.name, className: 'p-0' })}>
              <Indicator show={indicator} top='2px' right='-5px'>@{me.name}</Indicator>
            </span>
            <Badges user={me} className='ms-1' height={16} width={14} />
          </div>
        </Menu.Trigger>
        <Menu.Popup align='end'>
          <Menu.Item href={'/' + me.name} active={me.name === dropNavKey}>
            <Indicator show={profileIndicator} top='2px' right='-10px'>profile</Indicator>
          </Menu.Item>
          <Menu.Item href={'/' + me.name + '/bookmarks'} active={me.name + '/bookmarks' === dropNavKey}>bookmarks</Menu.Item>
          <Menu.Item href='/wallets' active={topKey === 'wallets'}>
            <Indicator show={walletIndicator} top='2px' right='-10px'>wallets</Indicator>
          </Menu.Item>
          <Menu.Item href='/satistics' active={topKey === 'satistics'}>satistics</Menu.Item>
          <Menu.Separator />
          <Menu.Item href='/invites' active={topKey === 'invites'}>invites</Menu.Item>
          <Menu.Separator />
          <div className='flex items-center'>
            <Menu.Item href='/settings' active={topKey === 'settings'}>settings</Menu.Item>
          </div>
          <Menu.Separator />
          <LogoutDropdownItem />
        </Menu.Popup>
      </Menu>
    </div>
  )
}

// this is the width of the 'switch account' button if no width is given
const SWITCH_ACCOUNT_BUTTON_WIDTH = '162px'

export function SignUpButton ({ className, width }) {
  const router = useRouter()
  const handleLogin = useCallback(async pathname => await router.push({
    pathname,
    query: { callbackUrl: window.location.origin + router.asPath }
  }), [router])

  return (
    <Button
      className={classNames('items-center ps-2 pe-4 py-0', className)}
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
      className='items-center px-4 py-1'
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
  const router = useRouter()

  const handleLogout = async () => {
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

    await signOut({ callbackUrl: window.location.origin + '/' })
  }

  return (
    <div className='text-center'>
      <h4 className='mb-4'>I reckon you want to logout?</h4>
      <ObstacleButtons
        onClose={onClose}
        onConfirm={handleLogout}
        confirmText='logout'
        confirmVariant='primary'
      />
    </div>
  )
}

// Items use popup semantics in MeDropdown and plain navigation semantics in
// the mobile drawer.
export function LogoutDropdownItem ({ handleClose, className }) {
  const showModal = useShowModal()

  return (
    <>
      <Menu.Item
        className={className} onClick={() => {
          handleClose?.()
          showModal(onClose => <SwitchAccountList onClose={onClose} />)
        }}
      >switch account
      </Menu.Item>
      <Menu.Item
        className={className}
        onClick={async () => {
          handleClose?.()
          showModal(onClose => <LogoutObstacle onClose={onClose} />)
        }}
      >logout
      </Menu.Item>
    </>
  )
}

function SwitchAccountButton ({ handleClose }) {
  const showModal = useShowModal()
  const accounts = useAccounts()

  if (accounts.length === 0) return null

  return (
    <Button
      className='items-center px-4 py-1'
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

// dual-mode like LogoutDropdownItem: in-menu items in AnonDropdown, where
// closeOnClick closes the menu before the button's navigation or modal, and
// plain divs in the drawer (className='px-0' from there)
export function LoginButtons ({ handleClose, className }) {
  return (
    <>
      <Menu.Item className={classNames('py-1', className)}>
        <LoginButton />
      </Menu.Item>
      <Menu.Item className={classNames('py-1', className)}>
        <SignUpButton className='py-1' />
      </Menu.Item>
      <Menu.Item className={classNames('py-1', className)}>
        <SwitchAccountButton handleClose={handleClose} />
      </Menu.Item>
    </>
  )
}

export function AnonDropdown () {
  return (
    <div className='relative'>
      <Menu className={classNames(styles.dropdown, 'pe-0')}>
        <Menu.Trigger className={navLinkClasses({ className: 'font-medium ps-0 pe-0 py-0.5' })}>
          <span className={navLinkClasses({ className: 'p-0 font-normal' })}>
            @anon<Badges user={{ id: USER_ID.anon }} />
          </span>
        </Menu.Trigger>
        <Menu.Popup align='end' className='p-4'>
          <LoginButtons />
        </Menu.Popup>
      </Menu>
    </div>
  )
}

export function Sorts ({ prefix, className }) {
  return (
    <>
      <Nav.Item className={className}>
        <Nav.Link href={prefix + '/'} eventKey='' className={`${styles.navSort} py-1 px-2`}>lit</Nav.Link>
      </Nav.Item>
      <Nav.Item className={className}>
        <Nav.Link href={prefix + '/new'} eventKey='new' className={`${styles.navSort} py-1 px-2`}>new</Nav.Link>
      </Nav.Item>
      <Nav.Item className={className}>
        <Nav.Link href={prefix + '/top/posts/day'} eventKey='top' className={`${styles.navSort} py-1 px-2`}>top</Nav.Link>
      </Nav.Item>
    </>
  )
}

export function PostItem ({ className, prefix, size }) {
  const branding = useBranding()
  const isLurker = useIsLurker()
  // when a custom primary color is set we let the button text follow the skin's
  // --sn-btn-color (YIQ-computed --sn-primary-text); otherwise force text-black
  const textOverride = branding?.primaryColor ? '' : 'text-black'
  return (
    <Link href={prefix + '/post'} className={buttonClasses({ variant: isLurker ? 'grey' : 'primary', size, className: [className, textOverride, 'md:py-1'] })}>
      post
    </Link>
  )
}

export function RightCorner ({ dropNavKey, className = 'flex' }) {
  const { me } = useMe()
  const isLurker = useIsLurker()
  return (
    <>
      {me
        ? <MeCorner dropNavKey={dropNavKey} me={me} className={className} />
        : isLurker
          ? <LurkerCorner className={className} />
          : <AnonCorner className={className} />}
    </>
  )
}

export function MeCorner ({ dropNavKey, me, className }) {
  return (
    <div className={className}>
      <NavNotifications />
      <MeDropdown me={me} dropNavKey={dropNavKey} />
      <NavWalletSummary className='inline-flex items-center ms-1' />
    </div>
  )
}

export function AnonCorner ({ className }) {
  return (
    <div className={className}>
      <AnonDropdown />
    </div>
  )
}

// add signup button to lurker corner
export function LurkerCorner ({ className }) {
  return (
    <div className={className}>
      <SignUpButton width='auto' />
    </div>
  )
}
