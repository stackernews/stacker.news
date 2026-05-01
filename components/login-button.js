import GithubIcon from '@/svgs/github-fill.svg'
import TwitterIcon from '@/svgs/twitter-fill.svg'
import LightningIcon from '@/svgs/bolt.svg'
import NostrIcon from '@/svgs/nostr.svg'
import Button from 'react-bootstrap/Button'
import useCookie from './use-cookie'
import { cookieOptions, MULTI_AUTH_POINTER } from '@/lib/auth'
import { useAccounts } from './account'
import SNIcon from '@/svgs/sn.svg'
import { ButtonGroup, Dropdown } from 'react-bootstrap'
import styles from '@/components/dropdown.module.css'
import ArrowDownIcon from '@/svgs/editor/toolbar/arrow-down.svg'
import classNames from 'classnames'
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
        height={20} className='me-3'
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
  if (!account) return null

  const title = `Log in with @${account?.name}`

  return (
    <Dropdown className='mb-4 w-100' as={ButtonGroup}>
      <Button
        variant='success'
        onClick={() => router.push(callbackUrl)}
        disabled={disabled}
        className={className}
        title={title}
        style={{ minWidth: 0 }}
      >
        <SNIcon width={20} height={20} className='me-3 flex-shrink-0' />
        <span className='text-truncate' style={{ minWidth: 0 }}>{title}</span>
      </Button>
      {accounts.length > 1 && (
        <>
          <Dropdown.Toggle
            split
            variant='success'
            onPointerDown={e => { e.preventDefault(); e.stopPropagation() }}
            title='select account'
            style={{ maxWidth: '42px' }}
          >
            <ArrowDownIcon width={16} height={16} />
          </Dropdown.Toggle>
          <Dropdown.Menu className={styles.dropdownExtra} style={{ width: '150px' }}>
            {accounts.map(account => (
              <Dropdown.Item
                key={account.id}
                onClick={() => setPointerCookie(account.id, cookieOptions({ httpOnly: false }))}
                className={classNames(styles.dropdownExtraItem, Number(account.id) === Number(pointerCookie) && styles.active)}
              >
                <span className={styles.dropdownExtraItemText}>{account.name}</span>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </>
      )}
    </Dropdown>
  )
}
