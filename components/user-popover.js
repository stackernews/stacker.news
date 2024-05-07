import { USER } from '@/fragments/users'
import errorStyles from '@/styles/error.module.css'
import { useLazyQuery } from '@apollo/client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { Popover } from 'react-bootstrap'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import { UserBase, UserSkeleton } from './user-list'
import styles from './user-popover.module.css'
import classNames from 'classnames'
import ItemPopover from './item-popover'

function StackingSince ({ since }) {
  return (
    <small className='text-muted d-flex-inline'>
      stacking since:{' '}
      {since
        ? (
          <ItemPopover id={since}>
            <Link href={`/items/${since}`}>#{since}</Link>
          </ItemPopover>
          )
        : <span>never</span>}
    </small>
  )
}

export default function UserPopover ({ name, children }) {
  const [showOverlay, setShowOverlay] = useState(false)

  const [getUser, { loading, data }] = useLazyQuery(
    USER,
    {
      variables: { name },
      fetchPolicy: 'cache-first'
    }
  )

  const timeoutId = useRef(null)

  const handleMouseEnter = () => {
    clearTimeout(timeoutId.current)
    getUser()
    timeoutId.current = setTimeout(() => {
      setShowOverlay(true)
    }, 500)
  }

  const handleMouseLeave = () => {
    clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => setShowOverlay(false), 100)
  }

  return (
    <OverlayTrigger
      show={showOverlay}
      placement='bottom'
      onHide={handleMouseLeave}
      overlay={
        <Popover
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={styles.userPopover}
        >
          <Popover.Body className={styles.userPopBody}>
            {!data || loading
              ? <UserSkeleton />
              : !data.user
                  ? <h1 className={classNames(errorStyles.status, errorStyles.describe)}>USER NOT FOUND</h1>
                  : (
                    <UserBase user={data.user} className='mb-0 pb-0'>
                      <StackingSince since={data.user.since} />
                    </UserBase>
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
