import { ITEM } from '@/fragments/items'
import { isAbortError } from '@/lib/error'
import errorStyles from '@/styles/error.module.css'
import { useLazyQuery } from '@apollo/client/react'
import classNames from 'classnames'
import PreviewCard from './ui/preview-card'
import { ItemSkeleton, ItemSummary } from './item'
import { useCallback } from 'react'

export default function ItemPreviewCard ({ id, children }) {
  const [execute, { loading, data }] = useLazyQuery(ITEM, {
    fetchPolicy: 'cache-first'
  })

  const getItem = useCallback(() => {
    execute({ variables: { id } }).catch(err => !isAbortError(err) && console.error(err))
  }, [execute, id])

  return (
    <PreviewCard
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
