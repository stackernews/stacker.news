import Link from 'next/link'
import { NavLink, NavItem, navLinkClasses } from '@/components/ui/nav'
import Button, { buttonClasses } from '@/components/ui/button'
import { Menu, MenuTrigger, MenuPopup, MenuItem, MenuSeparator } from '@/components/ui/menu'
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
    <NavLink href='/search' eventKey='search' className={classNames('py-0.5 px-2', className)}>
      <SearchIcon className='theme' width={22} height={28} />
    </NavLink>
  )
}

export function NavPrice ({ className }) {
  return (
    <NavItem className={classNames(styles.price, className)}>
      <Price className={navLinkClasses({ className: 'py-0.5 px-2 font-mono' })} />
    </NavItem>
  )
}

const PREPEND_SUBS = ['home']
const APPEND_SUBS = [{ label: '--------', items: ['create'] }]
export function NavSelect ({ sub: subName, className, size }) {
  const sub = subName || 'home'

  return (
    <NavItem className={className}>
      <SubSelect
        sub={sub} prependSubs={PREPEND_SUBS} appendSubs={APPEND_SUBS} noForm
        groupClassName='mb-0' size={size}
      />
    </NavItem>
  )
}

export function NavNotifications ({ className }) {
  const hasNewNotes = useHasNewNotes()

  return (
    <>
      <NavLink href='/notifications' eventKey='notifications' className={classNames('py-0.5 px-2', className)}>
        <Indicator show={hasNewNotes} top='2px' right='0px' variant='danger'>
          <NoteIcon height={28} width={20} className='theme' />
        </Indicator>
      </NavLink>
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
    <NavItem className={className}>
      <NavLink href='/wallets' eventKey='wallets' className='text-success font-mono py-0.5 px-0 whitespace-nowrap'>
        <WalletSummary me={me} />
      </NavLink>
    </NavItem>
  )
}

export const Indicator = ({ show, top = '0px', right = '0px', variant = 'secondary', children }) => {
  return (
    <div className='w-fit relative'>
      {children}
      {show && (
        <span
          className={`absolute p-1 ${variant === 'danger' ? 'bg-danger' : 'bg-secondary'}`}
          style={{ top, right, height: '5px', width: '5px', border: '1px solid var(--sn-body-bg)' }}
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
  // the first segment of dropNavKey is the top nav key (see useNavKeys)
  const topKey = dropNavKey?.split('/')[0]

  return (
    <div className='ms-2'>
      <Menu className={styles.dropdown}>
        <MenuTrigger className={navLinkClasses({ className: 'font-normal ps-0 pe-2 py-0.5' })}>
          <div className='flex items-center'>
            <span className={navLinkClasses({ active: topKey === me.name, className: 'p-0' })}>
              <Indicator show={indicator} top='2px' right='-5px'>@{me.name}</Indicator>
            </span>
            <Badges user={me} className='ms-1' height={16} width={14} />
          </div>
        </MenuTrigger>
        <MenuPopup align='end'>
          <MenuItem href={'/' + me.name} active={me.name === dropNavKey}>
            <Indicator show={profileIndicator} top='2px' right='-10px'>profile</Indicator>
          </MenuItem>
          <MenuItem href={'/' + me.name + '/bookmarks'} active={me.name + '/bookmarks' === dropNavKey}>bookmarks</MenuItem>
          <MenuItem href='/wallets' active={topKey === 'wallets'}>
            <Indicator show={walletIndicator} top='2px' right='-10px'>wallets</Indicator>
          </MenuItem>
          <MenuItem href='/satistics' active={topKey === 'satistics'}>satistics</MenuItem>
          <MenuSeparator />
          <MenuItem href='/invites' active={topKey === 'invites'}>invites</MenuItem>
          <MenuSeparator />
          <div className='flex items-center'>
            <MenuItem href='/settings' active={topKey === 'settings'}>settings</MenuItem>
          </div>
          <MenuSeparator />
          <LogoutDropdownItem />
        </MenuPopup>
      </Menu>
    </div>
  )
}

// this is the width of the 'switch account' button if no width is given
const SWITCH_ACCOUNT_BUTTON_WIDTH = '162px'

export function SignUpButton ({ className, width, onClick, ...props }) {
  const router = useRouter()
  const handleLogin = useCallback(async pathname => await router.push({
    pathname,
    query: { callbackUrl: window.location.origin + router.asPath }
  }), [router])

  return (
    <Button
      {...props}
      className={classNames('items-center ps-2 pe-4 py-0', className)}
      // 161px is the width of the 'switch account' button
      style={{ borderWidth: '2px', width: width || SWITCH_ACCOUNT_BUTTON_WIDTH }}
      id='signup'
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) handleLogin('/signup')
      }}
    >
      <LightningIcon
        width={17}
        height={17}
        className='me-1'
      />sign up
    </Button>
  )
}

export default function LoginButton ({ className, onClick, ...props }) {
  const router = useRouter()
  const handleLogin = useCallback(async pathname => await router.push({
    pathname,
    query: { callbackUrl: window.location.origin + router.asPath }
  }), [router])

  return (
    <Button
      {...props}
      className={classNames('items-center px-4 py-1', className)}
      id='login'
      style={{ borderWidth: '2px', width: SWITCH_ACCOUNT_BUTTON_WIDTH }}
      variant='outline-grey-darkmode'
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) handleLogin('/login')
      }}
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

export function LogoutDropdownItem ({ handleClose, className }) {
  const showModal = useShowModal()

  return (
    <>
      <MenuItem
        className={className} onClick={() => {
          handleClose?.()
          showModal(onClose => <SwitchAccountList onClose={onClose} />)
        }}
      >switch account
      </MenuItem>
      <MenuItem
        className={className}
        onClick={async () => {
          handleClose?.()
          showModal(onClose => <LogoutObstacle onClose={onClose} />)
        }}
      >logout
      </MenuItem>
    </>
  )
}

function SwitchAccountButton ({ handleClose, className, onClick, ...props }) {
  const showModal = useShowModal()
  const accounts = useAccounts()

  if (accounts.length === 0) return null

  return (
    <Button
      {...props}
      className={classNames('items-center px-4 py-1', className)}
      variant='outline-grey-darkmode'
      style={{ borderWidth: '2px', width: SWITCH_ACCOUNT_BUTTON_WIDTH }}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
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

// menu items in AnonDropdown, plain divs in the mobile drawer
export function LoginButtons ({ handleClose, className, asMenuItems }) {
  if (asMenuItems) {
    return (
      <>
        <MenuItem className={classNames('py-1', className)} render={<LoginButton />} />
        <MenuItem className={classNames('py-1', className)} render={<SignUpButton className='py-1' />} />
        <MenuItem className={classNames('py-1', className)} render={<SwitchAccountButton handleClose={handleClose} />} />
      </>
    )
  }

  return (
    <>
      <MenuItem className={classNames('py-1', className)}>
        <LoginButton />
      </MenuItem>
      <MenuItem className={classNames('py-1', className)}>
        <SignUpButton className='py-1' />
      </MenuItem>
      <MenuItem className={classNames('py-1', className)}>
        <SwitchAccountButton handleClose={handleClose} />
      </MenuItem>
    </>
  )
}

export function AnonDropdown () {
  return (
    <div className='relative'>
      <Menu className={classNames(styles.dropdown, 'pe-0')}>
        <MenuTrigger className={navLinkClasses({ className: 'font-medium ps-0 pe-0 py-0.5' })}>
          <span className={navLinkClasses({ className: 'p-0 font-normal' })}>
            @anon<Badges user={{ id: USER_ID.anon }} />
          </span>
        </MenuTrigger>
        <MenuPopup align='end' className='p-4'>
          <LoginButtons asMenuItems />
        </MenuPopup>
      </Menu>
    </div>
  )
}

export function Sorts ({ prefix, className }) {
  return (
    <>
      <NavItem className={className}>
        <NavLink href={prefix + '/'} eventKey='' className={`${styles.navSort} py-1 px-2`}>lit</NavLink>
      </NavItem>
      <NavItem className={className}>
        <NavLink href={prefix + '/new'} eventKey='new' className={`${styles.navSort} py-1 px-2`}>new</NavLink>
      </NavItem>
      <NavItem className={className}>
        <NavLink href={prefix + '/top/posts/day'} eventKey='top' className={`${styles.navSort} py-1 px-2`}>top</NavLink>
      </NavItem>
    </>
  )
}

export function PostItem ({ className, prefix, size }) {
  const branding = useBranding()
  const isLurker = useIsLurker()
  // when a custom primary color is set we let the button text follow --sn-btn-color
  // otherwise we use the default text-black
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
