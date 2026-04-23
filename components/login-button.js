import GithubIcon from '@/svgs/github-fill.svg'
import TwitterIcon from '@/svgs/twitter-fill.svg'
import LightningIcon from '@/svgs/bolt.svg'
import NostrIcon from '@/svgs/nostr.svg'
import Button from 'react-bootstrap/Button'
import useCookie from './use-cookie'
import { MULTI_AUTH_POINTER } from '@/lib/auth'
import { useAccounts } from './account'
import SNIcon from '@/svgs/sn.svg'

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

// TODO: better design
// TODO: implement multi-account support with a dropdown
export function LoginWithNymButton ({ className, onClick, disabled }) {
  const accounts = useAccounts()
  const [pointerCookie] = useCookie(MULTI_AUTH_POINTER)

  const account = accounts.find(account => account.id === Number(pointerCookie))

  if (!account) return null

  return (
    <Button className={className} variant='success' onClick={onClick} disabled={disabled}>
      <SNIcon
        width={20}
        height={20} className='me-3'
      /> Login with @{account?.name}
    </Button>
  )
}
