import { USER_FULL } from '@/fragments/users'
import Moon from '@/svgs/moon-fill.svg'
import CodeIcon from '@/svgs/terminal-box-fill.svg'
import { useQuery } from '@apollo/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Popover } from 'react-bootstrap'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import { SocialLink } from './user-header'
import { User } from './user-list'

function UserDetails ({ user }) {
  return (
    <div className='d-flex flex-column'>
      <small className='text-muted d-flex-inline'>stacking since: {user.since
        ? <Link href={`/items/${user.since}`} className='ms-1'>#{user.since}</Link>
        : <span>never</span>}
      </small>
      {user.optional.maxStreak !== null &&
        <small className='text-muted d-flex-inline'>longest cowboy streak: {user.optional.maxStreak}</small>}
      {user.optional.isContributor &&
        <small className='text-muted d-flex align-items-center'>
          <CodeIcon className='me-1' height={16} width={16} /> verified stacker.news contributor
        </small>}
      {user.optional.nostrAuthPubkey &&
        <small className='text-muted d-flex-inline'>
          <SocialLink name='Nostr' id={user.optional.nostrAuthPubkey} />
        </small>}
      {user.optional.githubId &&
        <small className='text-muted d-flex-inline'>
          <SocialLink name='Github' id={user.optional.githubId} />
        </small>}
      {user.optional.twitterId &&
        <small className='text-muted d-flex-inline'>
          <SocialLink name='Twitter' id={user.optional.twitterId} />
        </small>}
    </div>
  )
}

export default function UserPopover ({ text, children }) {
  const [user, setUser] = useState(null)
  const [isTriggered, setIsTriggered] = useState(false)
  const { data } = useQuery(USER_FULL, {
    variables: { name: text.replace('@', '') },
    skip: !isTriggered
  })

  useEffect(() => {
    if (isTriggered && data) {
      setUser(data.user)
    }
  }, [data, isTriggered])

  const handleOverlayTrigger = () => {
    setIsTriggered(true)
  }

  return (
    <OverlayTrigger
      trigger={['hover', 'focus']}
      onEntered={handleOverlayTrigger}
      overlay={
        <Popover placement='auto' style={{ border: '1px solid var(--theme-toolbarActive)' }}>
          <Popover.Body style={{ fontWeight: 500, fontSize: '.9rem' }}>
            {user
              ? (
                <User user={user} Embellish={() => <UserDetails user={user} />} />
                )
              : (
                <Moon className='spin fill-grey' />
                )}
          </Popover.Body>
        </Popover>
            }
    >
      {children}
    </OverlayTrigger>
  )
}
