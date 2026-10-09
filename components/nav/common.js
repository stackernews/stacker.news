import Link from 'next/link'
import { NavLink, NavItem, navLinkClasses } from '@/components/ui/nav'
import Button, { buttonClasses } from '@/components/ui/button'
import { Menu, MenuTrigger, MenuPopup, MenuItem, MenuSeparator } from '@/components/ui/menu'
import styles from '../header.module.css'
import { useRouter } from 'next/router'
import BackArrow from '../../svgs/arrow-left-line.svg'
import { useCallback, useEffect, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { ACTIVE_SUBS } from '@/fragments/subs'
import { territoryHref } from '@/lib/navigation'
import SubSelect from '../sub-select'
import { PUBLIC_MEDIA_URL } from '../../lib/constants'
import NoteIcon from '../../svgs/notification-4-fill.svg'
import { useMe } from '../me'
import { abbrNum } from '../../lib/format'
import { useServiceWorker } from '../serviceworker'
import { signOut } from 'next-auth/react'
import Badges from '../badge'
import LightningIcon from '../../svgs/bolt.svg'
import SearchIcon from '../../svgs/search-line.svg'
import { cn } from '@/lib/cn'
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
    <Link href='/' className={cn(styles.brand, className)}>
      {logoUrl
        ? <img src={logoUrl} alt='site logo' width={36} height={36} className={styles.brandImage} loading='eager' decoding='async' />
        : <SnIcon width={36} height={36} />}
    </Link>
  )
}

export function Back ({ className, fallback = null }) {
  const router = useRouter()
  const [back, setBack] = useState(router.asPath !== '/')

  useEffect(() => {
    setBack(router.asPath !== '/' && (typeof window.navigation === 'undefined' || window.navigation.canGoBack === undefined || window?.navigation.canGoBack))
  }, [router.asPath])

  if (!back) return fallback

  return (
    <NavLink
      className={cn('p-0 me-3 md:me-4', className)}
      aria-label='back'
      onClick={() => router.back()}
    >
      <BackArrow width={24} height={24} />
    </NavLink>
  )
}

export function SearchItem ({ className }) {
  return (
    <NavLink href='/search' eventKey='search' className={className}>
      <SearchIcon width={22} height={28} />
    </NavLink>
  )
}

const PREPEND_SUBS = ['home']
const APPEND_SUBS = [{ label: '--------', items: ['create'] }]
export function NavSelect ({ sub: subName, className }) {
  const router = useRouter()
  const client = useApolloClient()
  const { me } = useMe()
  const sub = subName || 'home'

  const onChange = (_, e) => {
    const selected = e.target.value
    const territory = client.readQuery({ query: ACTIVE_SUBS })?.activeSubs?.find(sub => sub.name === selected)
    const canEdit = !!me && territory?.userId != null && String(territory.userId) === String(me.id)
    router.push(territoryHref(router.asPath, selected, { canEdit }))
  }

  return (
    <NavItem className={className}>
      <SubSelect
        sub={sub} prependSubs={PREPEND_SUBS} appendSubs={APPEND_SUBS}
        id='nav-sub' aria-label='switch territory' title={sub} onChange={onChange}
        groupClassName='mb-0 min-w-0' className='min-w-0 w-full md:h-8'
      />
    </NavItem>
  )
}

export function NavNotifications ({ className }) {
  const hasNewNotes = useHasNewNotes()

  return (
    <>
      <NavLink href='/notifications' eventKey='notifications' className={className}>
        <Indicator show={hasNewNotes} top='2px' right='0px' variant='danger'>
          <NoteIcon height={28} width={20} />
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
  return (
    <NavItem className={className}>
      <NavLink href='/wallets' eventKey='wallets' className='text-success font-mono px-0 whitespace-nowrap'>
        <WalletSummary />
      </NavLink>
    </NavItem>
  )
}

export const Indicator = ({ show, top = '0px', right = '0px', variant = 'secondary', className, children }) => {
  return (
    <div className={cn('w-fit relative', className)}>
      {children}
      {show && (
        <span
          className={cn('absolute p-1', variant === 'danger' ? 'bg-danger' : 'bg-secondary')}
          style={{ top, right, height: '5px', width: '5px', border: '1px solid var(--sn-body-bg)' }}
        >
          <span className='invisible'>{' '}</span>
        </span>
      )}
    </div>
  )
}

function MeDropdown ({ me, dropNavKey }) {
  const walletIndicator = useWalletIndicator()

  const profileIndicator = !me.bioId
  const indicator = profileIndicator || walletIndicator
  // the first segment of dropNavKey is the top nav key (see useNavKeys)
  const topKey = dropNavKey?.split('/')[0]

  return (
    <div className='min-w-0'>
      <Menu className={styles.dropdown}>
        <MenuTrigger className={navLinkClasses({ className: 'max-w-full font-normal px-0' })}>
          <div className='flex min-w-0 items-center'>
            <span className={navLinkClasses({ active: topKey === me.name, className: 'min-w-0 p-0' })}>
              <Indicator show={indicator} top='2px' right='-5px' className='max-w-full'>
                <span className='block max-w-32 truncate lg:max-w-48' title={`@${me.name}`}>@{me.name}</span>
              </Indicator>
            </span>
            <Badges user={me} className='ms-1 shrink-0' height={16} width={14} />
          </div>
        </MenuTrigger>
        <MenuPopup align='end' positionMethod='fixed'>
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

function SignUpButton ({ className, width }) {
  const router = useRouter()
  const handleLogin = useCallback(async pathname => await router.push({
    pathname,
    query: { callbackUrl: window.location.origin + router.asPath }
  }), [router])

  return (
    <Button
      className={cn('items-center ps-2 pe-4 py-0', className)}
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

function LoginButton ({ className, width }) {
  const router = useRouter()
  const handleLogin = useCallback(async pathname => await router.push({
    pathname,
    query: { callbackUrl: window.location.origin + router.asPath }
  }), [router])

  return (
    <Button
      className={cn('items-center px-4 py-1', className)}
      id='login'
      style={{ borderWidth: '2px', width: width || SWITCH_ACCOUNT_BUTTON_WIDTH }}
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

function SwitchAccountButton ({ handleClose, className, width }) {
  const showModal = useShowModal()

  return (
    <Button
      className={cn('items-center px-4 py-1', className)}
      variant='outline-grey-darkmode'
      style={{ borderWidth: '2px', width: width || SWITCH_ACCOUNT_BUTTON_WIDTH }}
      onClick={() => {
        // login buttons rendered in the drawer aren't wrapped inside <Menu>
        // so we manually close the drawer in that case by passing down handleClose here
        handleClose?.()
        showModal(onClose => <SwitchAccountList onClose={onClose} />)
      }}
    >
      switch account
    </Button>
  )
}

export function LoginButtons ({ handleClose, className }) {
  const accounts = useAccounts()

  return (
    <>
      <MenuItem className={cn('py-1', className)}>
        <LoginButton />
      </MenuItem>
      <MenuItem className={cn('py-1', className)}>
        <SignUpButton className='py-1' />
      </MenuItem>
      {accounts.length > 0 && (
        <MenuItem className={cn('py-1', className)}>
          <SwitchAccountButton handleClose={handleClose} />
        </MenuItem>
      )}
    </>
  )
}

export function Sorts ({ prefix, linkClassName }) {
  return (
    <>
      <NavItem>
        <NavLink href={prefix + '/'} eventKey='' className={cn(styles.navSort, 'py-1', linkClassName)}>lit</NavLink>
      </NavItem>
      <NavItem>
        <NavLink href={prefix + '/new'} eventKey='new' className={cn(styles.navSort, 'py-1', linkClassName)}>new</NavLink>
      </NavItem>
      <NavItem>
        <NavLink href={prefix + '/top/posts/day'} eventKey='top' className={cn(styles.navSort, 'py-1', linkClassName)}>top</NavLink>
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
    <Link
      href={prefix + '/post'}
      className={buttonClasses({
        variant: isLurker ? 'grey' : 'primary',
        size,
        className: cn(className, textOverride, 'md:py-1')
      })}
    >
      post
    </Link>
  )
}

const compactButtonClasses = 'inline-flex h-8 justify-center px-3 py-0 text-sm whitespace-nowrap'

export function RightCorner ({ dropNavKey }) {
  const { me } = useMe()
  const accounts = useAccounts()
  return (
    <div className='flex min-w-0 items-center gap-2'>
      {me
        ? (
          <>
            <NavNotifications className='shrink-0 px-1' />
            <MeDropdown me={me} dropNavKey={dropNavKey} />
            <NavWalletSummary className='inline-flex shrink-0 items-center' />
          </>
          )
        : (
          <>
            <LoginButton width='auto' className={compactButtonClasses} />
            <SignUpButton width='auto' className={cn(compactButtonClasses, 'ps-3 pe-3')} />
            {accounts.length > 0 && <SwitchAccountButton width='auto' className={compactButtonClasses} />}
          </>
          )}
    </div>
  )
}
