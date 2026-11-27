import GithubIcon from '@/svgs/github-fill.svg'
import TwitterIcon from '@/svgs/twitter-fill.svg'
import LightningIcon from '@/svgs/bolt.svg'
import NostrIcon from '@/svgs/nostr.svg'
import Button, { buttonClasses } from '@/components/ui/button'
import { Menu, MenuTrigger, MenuPopup } from '@/components/ui/menu'
import useCookie from './use-cookie'
import { MULTI_AUTH_POINTER } from '@/lib/auth'
import { SwitchAccountMenuItems, useAccounts, useSwitchAccount } from './account'
import SNIcon from '@/svgs/sn.svg'
import ArrowDownIcon from '@/svgs/editor/toolbar/arrow-down.svg'
import { cn } from '@/lib/cn'

export default function LoginButton ({ text, type, className, onClick, disabled }) {
  let Icon, variant
  switch (type) {
    case 'twitter':
      Icon = TwitterIcon
      variant = 'twitter'
      break
    case 'github':
      Icon = GithubIcon
      variant = 'dark'
      break
    case 'nostr':
      Icon = NostrIcon
      variant = 'nostr'
      break
    case 'lightning':
    default:
      Icon = LightningIcon
      variant = 'primary'
      break
  }

  const name = type.charAt(0).toUpperCase() + type.substr(1).toLowerCase()

  return (
    <Button className={className} variant={variant} onClick={onClick} disabled={disabled}>
      <Icon
        width={20}
        height={20} className='me-4'
      />
      {text} {name}
    </Button>
  )
}

export function LoginWithNymButton ({ className, callbackUrl }) {
  const accounts = useAccounts()
  const [pointerCookie] = useCookie(MULTI_AUTH_POINTER)
  const switchAccount = useSwitchAccount()

  // the server keeps the list recent first, so on @anon this is the account used last
  const current = accounts.find(account => account.id === Number(pointerCookie)) ?? accounts[0]
  if (!current) return null

  const title = `Continue as @${current.name}`
  const menu = accounts.length > 1

  return (
    <div className={cn('flex w-full mb-6', className)}>
      <Button
        variant='success'
        onClick={() => switchAccount(current, callbackUrl)}
        className={cn('flex min-w-0 grow items-center justify-center', menu && 'rounded-e-none')}
        title={title}
      >
        <SNIcon width={20} height={20} className='me-4 shrink-0' />
        <span className='truncate'>{title}</span>
      </Button>
      {menu && (
        <Menu className='flex'>
          <MenuTrigger
            title='switch account'
            className={buttonClasses({ variant: 'success', className: 'flex w-10 items-center justify-center rounded-s-none px-0' })}
          >
            <ArrowDownIcon width={16} height={16} />
          </MenuTrigger>
          <MenuPopup align='end'>
            <SwitchAccountMenuItems callbackUrl={callbackUrl} />
          </MenuPopup>
        </Menu>
      )}
    </div>
  )
}
