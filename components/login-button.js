import GithubIcon from '@/svgs/github-fill.svg'
import TwitterIcon from '@/svgs/twitter-fill.svg'
import LightningIcon from '@/svgs/bolt.svg'
import NostrIcon from '@/svgs/nostr.svg'
import Button, { buttonClasses } from '@/components/ui/button'
import { Menu, MenuTrigger, MenuPopup } from '@/components/ui/menu'
import { Menu as BaseMenu } from '@base-ui/react/menu'
import useCookie from './use-cookie'
import { cookieOptions, MULTI_AUTH_POINTER } from '@/lib/auth'
import { useAccounts } from './account'
import SNIcon from '@/svgs/sn.svg'
import styles from '@/components/dropdown.module.css'
import ArrowDownIcon from '@/svgs/editor/toolbar/arrow-down.svg'
import classNames from 'classnames'
import { cn } from '@/lib/cn'
import { useRouter } from 'next/router'

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

export function LoginWithNymButton ({ className, callbackUrl, disabled }) {
  const router = useRouter()
  const accounts = useAccounts()
  const [pointerCookie, setPointerCookie] = useCookie(MULTI_AUTH_POINTER)

  const account = accounts.find(account => account.id === Number(pointerCookie))
  if (!accounts.length) return null

  const title = account ? `Log in with @${account.name}` : 'Log in with @nym'

  return (
    <div className='inline-flex w-full mb-6'>
      <Button
        variant='success'
        onClick={() => account && router.push(callbackUrl)}
        disabled={disabled || !account}
        className={cn('min-w-0 grow rounded-e-none', className)}
        title={title}
      >
        <SNIcon width={20} height={20} className='me-4 shrink-0' />
        <span className='truncate min-w-0'>{title}</span>
      </Button>
      {(accounts.length > 1 || !account) && (
        <Menu className='flex shrink-0'>
          <MenuTrigger
            title='select account'
            className={cn(buttonClasses({ variant: 'success' }), 'rounded-s-none w-10 px-0 shrink-0 flex items-center justify-center')}
          >
            <ArrowDownIcon width={16} height={16} />
          </MenuTrigger>
          <MenuPopup align='end' className={cn(styles.dropdownExtra, 'w-40 p-2 rounded-md')}>
            {accounts.map(account => (
              <BaseMenu.Item
                key={account.id}
                onClick={() => {
                  setPointerCookie(account.id, cookieOptions({ httpOnly: false }))
                }}
                className={classNames(styles.dropdownExtraItem, Number(account.id) === Number(pointerCookie) && styles.active)}
              >
                <span className={styles.dropdownExtraItemText}>{account.name}</span>
              </BaseMenu.Item>
            ))}
          </MenuPopup>
        </Menu>
      )}
    </div>
  )
}
