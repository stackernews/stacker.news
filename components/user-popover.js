import { USER_FULL } from '@/fragments/users'
import Moon from '@/svgs/moon-fill.svg'
import { useQuery } from '@apollo/client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Popover } from 'react-bootstrap'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import { User } from './user-list'

function StackingSince ({ since }) {
  return (
    <small className='text-muted d-flex-inline'>stacking since: {since
      ? <Link href={`/items/${since}`}>#{since}</Link>
      : <span>never</span>}
    </small>
  )
}

export default function UserPopover ({ name, children }) {
  const [user, setUser] = useState(null)
  const [isTriggered, setIsTriggered] = useState(false)
  const { data } = useQuery(USER_FULL, {
    variables: { name: name },
    skip: !isTriggered
  })

  useEffect(() => {
    if (isTriggered && data) {
      setUser(data.user)
    }
  }, [data, isTriggered])

  const timeoutId = useRef(null)

  const handleMouseEnter = () => {
    clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => setIsTriggered(true), 777)
  }

  const handleMouseLeave = () => {
    clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => setIsTriggered(false), 333)
  }

  return (
    <OverlayTrigger
      show={isTriggered}
      onHide={handleMouseLeave}
      overlay={
        <Popover
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{ border: '1px solid var(--theme-toolbarActive)' }}
        >
          <Popover.Body style={{ fontWeight: 500, fontSize: '.9rem' }}>
            {user
              ? (
                <User user={user} Embellish={() => <StackingSince since={user.since} />} />
                )
              : (
                <Moon className='spin fill-grey' />
                )}
          </Popover.Body>
        </Popover>
      }
    >
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>
    </OverlayTrigger>
  )
}
