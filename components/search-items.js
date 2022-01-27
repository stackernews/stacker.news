import { useQuery } from '@apollo/client'
import { ItemSkeleton } from './item'
import styles from './items.module.css'
import { ITEM_SEARCH } from '../fragments/items'
import MoreFooter from './more-footer'
import React from 'react'
import Comment from './comment'
import ItemFull from './item-full'

export default function SearchItems ({ variables, items, pins, cursor }) {
  const { data, fetchMore } = useQuery(ITEM_SEARCH, { variables })

  if (!data && !items) {
    return <ItemsSkeleton />
  }

  if (data) {
    ({ search: { items, cursor } } = data)
  }

  return (
    <>
      <div className={styles.grid}>
        {items.map((item, i) => (
          <React.Fragment key={item.id}>
            {item.parentId
              ? <><div /><div className='pb-3'><Comment item={item} noReply includeParent /></div></>
              : <><div /><div className={item.text ? 'pb-3' : ''}><ItemFull item={item} noReply /></div></>}
          </React.Fragment>
        ))}
      </div>
      <MoreFooter
        cursor={cursor} fetchMore={fetchMore}
        Skeleton={() => <ItemsSkeleton />}
      />
    </>
  )
}

function ItemsSkeleton () {
  const items = new Array(21).fill(null)

  return (
    <div className={styles.grid}>
      {items.map((_, i) => (
        <ItemSkeleton key={i} />
      ))}
    </div>
  )
}
