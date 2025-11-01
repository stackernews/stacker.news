import { USER, USER_BY_MENTION } from '@/fragments/users'
import errorStyles from '@/styles/error.module.css'
import { useLazyQuery, useQuery } from '@apollo/client'
import classNames from 'classnames'
import Link from 'next/link'
import HoverablePopover from './hoverable-popover'
import ItemPopover from './item-popover'
import { UserBase, UserSkeleton } from './user-list'

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

export default function UserPopover ({ name, itemId, children }) {
  const { data: mentionData, loading: mentionLoading } = useQuery(
    USER_BY_MENTION,
    {
      variables: { name, itemId },
      skip: !itemId,
      fetchPolicy: 'cache-first'
    }
  )

  const [getUser, { loading, data }] = useLazyQuery(
    USER,
    {
      variables: { name },
      fetchPolicy: 'cache-first'
    }
  )

  const resolvedUser = mentionData?.userByMention
  const popoverUser = resolvedUser || data?.user
  const isLoading = loading || (itemId && mentionLoading && !resolvedUser)
  const trigger =
    typeof children === 'function'
      ? children({ user: popoverUser })
      : children

  return (
    <HoverablePopover
      onShow={getUser}
      trigger={trigger}
      body={isLoading
        ? <UserSkeleton />
        : !popoverUser
            ? <h1 className={classNames(errorStyles.status, errorStyles.describe)}>USER NOT FOUND</h1>
            : (
              <UserBase user={popoverUser} className='mb-0 pb-0'>
                <StackingSince since={popoverUser.since} />
              </UserBase>
              )}
    />
  )
}
