import { USER_FULL } from '@/fragments/users'
import { NORMAL_POLL_INTERVAL, SSR } from '@/lib/constants'
import Moon from '@/svgs/moon-fill.svg'
import { useLazyQuery } from '@apollo/client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { Popover } from 'react-bootstrap'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import { User } from './user-list'
import errorStyles from '@/styles/error.module.css'

function StackingSince ({ since }) {
  return (
    <small className='text-muted d-flex-inline'>stacking since: {since
      ? <Link href={`/items/${since}`}>#{since}</Link>
      : <span>never</span>}
    </small>
  )
}

export default function UserPopover ({ name, children }) {
  const [showOverlay, setShowOverlay] = useState(false)

  const [getUser, query] = useLazyQuery(
    USER_FULL,
    SSR
      ? {}
      : {
          variables: { name },
          pollInterval: NORMAL_POLL_INTERVAL,
          nextFetchPolicy: 'cache-and-network'
        }
  )

  const timeoutId = useRef(null)

  const handleMouseEnter = () => {
    clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => {
      setShowOverlay(true)
      getUser()
    }, 777)
  }

  const handleMouseLeave = () => {
    clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => setShowOverlay(false), 333)
  }

  return (
    <OverlayTrigger
      show={showOverlay}
      onHide={handleMouseLeave}
      overlay={
        <Popover
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{ border: '1px solid var(--theme-toolbarActive)' }}
        >
          <Popover.Body style={{ fontWeight: 500, fontSize: '.9rem' }}>
            {!query.data || query.loading
              ? <Moon className='spin fill-grey' />
              : !query.data.user
                  ? <h1 className={[errorStyles.status, errorStyles.describe].join(' ')}>USER NOT FOUND</h1>
                  : <User user={query.data.user} Embellish={() => <StackingSince since={query.data.user.since} />} />}
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
