import { USER } from '@/fragments/users'
import errorStyles from '@/styles/error.module.css'
import { useLazyQuery } from '@apollo/client/react'
import classNames from 'classnames'
import Link from 'next/link'
import HoverablePopover from './hoverable-popover'
import ItemPopover from './item-popover'
import { UserBase, UserSkeleton } from './user-list'
import { useCallback } from 'react'

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
  const [execute, { loading, data }] = useLazyQuery(
    USER,
    {
      fetchPolicy: 'cache-first'
    }
  )

  const getUser = useCallback(() => {
    execute({ variables: { name } })
  }, [execute, name])

  return (
    <HoverablePopover
      onShow={getUser}
      trigger={children}
      body={!data || loading
        ? <UserSkeleton />
        : !data.user
            ? <h1 className={classNames(errorStyles.status, errorStyles.describe)}>USER NOT FOUND</h1>
            : (
              <UserBase user={data.user} className='mb-0 pb-0'>
                <StackingSince since={data.user.since} />
              </UserBase>
              )}
    />
  )
}
