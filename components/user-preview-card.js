import { USER } from '@/fragments/users'
import { isAbortError } from '@/lib/error'
import errorStyles from '@/styles/error.module.css'
import { useLazyQuery } from '@apollo/client/react'
import classNames from 'classnames'
import Link from 'next/link'
import PreviewCard from './ui/preview-card'
import ItemPreviewCard from './item-preview-card'
import { UserBase, UserSkeleton } from './user-list'
import { useCallback } from 'react'

function StackingSince ({ since }) {
  return (
    <small className='text-muted'>
      stacking since:{' '}
      {since
        ? (
          <ItemPreviewCard id={since}>
            <Link href={`/items/${since}`}>#{since}</Link>
          </ItemPreviewCard>
          )
        : <span>never</span>}
    </small>
  )
}

export default function UserPreviewCard ({ name, children }) {
  const [execute, { loading, data }] = useLazyQuery(
    USER,
    {
      fetchPolicy: 'cache-first'
    }
  )

  const getUser = useCallback(() => {
    execute({ variables: { name } }).catch(err => !isAbortError(err) && console.error(err))
  }, [execute, name])

  return (
    <PreviewCard
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
