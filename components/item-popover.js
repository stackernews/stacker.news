import { ITEM } from '@/fragments/items'
import errorStyles from '@/styles/error.module.css'
import { useLazyQuery } from '@apollo/client/react'
import classNames from 'classnames'
import HoverablePopover from './hoverable-popover'
import { ItemSkeleton, ItemSummary } from './item'
import { useCallback } from 'react'

export default function ItemPopover ({ id, children }) {
  const [execute, { loading, data }] = useLazyQuery(ITEM, {
    fetchPolicy: 'cache-first'
  })

  const getItem = useCallback(() => {
    execute({ variables: { id } })
  }, [execute, id])

  return (
    <HoverablePopover
      onShow={getItem}
      trigger={children}
      body={!data || loading
        ? <ItemSkeleton showUpvote={false} />
        : !data.item
            ? <h1 className={classNames(errorStyles.status, errorStyles.describe)}>ITEM NOT FOUND</h1>
            : <ItemSummary item={data.item} />}
    />
  )
}
