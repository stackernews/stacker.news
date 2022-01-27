import { useQuery } from '@apollo/client'
import Item, { ItemSkeleton } from './item'
import styles from './items.module.css'
import { MORE_ITEMS } from '../fragments/items'
import MoreFooter from './more-footer'
import React from 'react'
import Comment from './comment'

export default function Items ({ variables, rank, items, pins, cursor }) {
  const { data, fetchMore } = useQuery(MORE_ITEMS, { variables })

  if (!data && !items) {
    return <ItemsSkeleton rank={rank} />
  }

  if (data) {
    ({ moreItems: { items, pins, cursor } } = data)
  }

  const pinMap = pins?.reduce((a, p) => { a[p.position] = p; return a }, {})

  return (
    <>
      <div className={styles.grid}>
        {items.map((item, i) => (
          <React.Fragment key={item.id}>
            {pinMap && pinMap[i + 1] && <Item item={pinMap[i + 1]} key={pinMap[i + 1].id} />}
            {item.parentId
              ? <><div /><div className='pb-3'><Comment item={item} noReply includeParent /></div></>
              : <Item item={item} rank={rank && i + 1} key={item.id} />}
          </React.Fragment>
        ))}
      </div>
      <MoreFooter
        cursor={cursor} fetchMore={fetchMore}
        Skeleton={() => <ItemsSkeleton rank={rank} startRank={items.length} />}
      />
    </>
  )
}

function ItemsSkeleton ({ rank, startRank = 0 }) {
  const items = new Array(21).fill(null)

  return (
    <div className={styles.grid}>
      {items.map((_, i) => (
        <ItemSkeleton rank={rank && i + startRank + 1} key={i + startRank} />
      ))}
    </div>
  )
}
