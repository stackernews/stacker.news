import { ITEM } from '@/fragments/items'
import errorStyles from '@/styles/error.module.css'
import { useLazyQuery } from '@apollo/client'
import classNames from 'classnames'
import HoverablePopover from './hoverable-popover'
import { ItemSkeleton, ItemSummary } from './item'

export default function ItemPopover ({ id, children }) {
  const [getItem, { loading, data }] = useLazyQuery(
    ITEM,
    {
      variables: { id },
      fetchPolicy: 'cache-first'
    }
  )

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
