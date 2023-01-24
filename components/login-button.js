import GithubIcon from '../svgs/github-fill.svg'
import TwitterIcon from '../svgs/twitter-fill.svg'
import LightningIcon from '../svgs/bolt.svg'
import SlashtagsIcon from '../svgs/slashtags.svg'
import { Button } from 'react-bootstrap'

export default function LoginButton ({ text, type, className, onClick }) {
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
    case 'lightning':
      Icon = LightningIcon
      variant = 'primary'
      break
    case 'slashtags':
      Icon = SlashtagsIcon
      variant = 'grey-medium'
      break
  }

  const name = type.charAt(0).toUpperCase() + type.substr(1).toLowerCase()

  return (
    <Button className={className} variant={variant} onClick={onClick}>
      <Icon
        width={20}
        height={20} className='mr-3'
      />
      {text} {name}
    </Button>
  )
}
