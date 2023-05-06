import { useQuery } from '@apollo/client'
import Item, { ItemSkeleton } from './item'
import ItemJob from './item-job'
import styles from './items.module.css'
import { ITEMS } from '../fragments/items'
import MoreFooter from './more-footer'
import { Fragment } from 'react'
import { CommentFlat } from './comment'

export default function Items ({ variables = {}, query, destructureData, rank, items, pins, cursor }) {
  const { data, fetchMore } = useQuery(query || ITEMS, { variables })

  if (!data && !items) {
    return <ItemsSkeleton rank={rank} />
  }

  if (data) {
    if (destructureData) {
      ({ items, pins, cursor } = destructureData(data))
    } else {
      ({ items: { items, pins, cursor } } = data)
    }
  }

  const pinMap = pins?.reduce((a, p) => { a[p.position] = p; return a }, {})

  return (
    <>
      <div className={styles.grid}>
        {items.map((item, i) => (
          <Fragment key={item.id}>
            {pinMap && pinMap[i + 1] && <Item item={pinMap[i + 1]} />}
            {item.parentId
              ? <><div /><div className='pb-3'><CommentFlat item={item} noReply includeParent /></div></>
              : (item.isJob
                  ? <ItemJob item={item} rank={rank && i + 1} />
                  : (item.title
                      ? <Item item={item} rank={rank && i + 1} />
                      : (
                        <div className='pb-2'>
                          <CommentFlat item={item} noReply includeParent clickToContext />
                        </div>)))}
          </Fragment>
        ))}
      </div>
      <MoreFooter
        cursor={cursor} fetchMore={fetchMore}
        Skeleton={() => <ItemsSkeleton rank={rank} startRank={items.length} />}
      />
    </>
  )
}

export function ItemsSkeleton ({ rank, startRank = 0 }) {
  const items = new Array(21).fill(null)

  return (
    <div className={styles.grid}>
      {items.map((_, i) => (
        <ItemSkeleton rank={rank && i + startRank + 1} key={i + startRank} />
      ))}
    </div>
  )
}
