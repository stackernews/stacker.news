import { Fragment } from 'react'
import { CommentFlat } from './comment'
import Item from './item'
import ItemJob from './item-job'
import { ItemsSkeleton } from './items'
import styles from './items.module.css'
import MoreFooter from './more-footer'

export default function MixedItems ({ rank, items, cursor, fetchMore }) {
  return (
    <>
      <div className={styles.grid}>
        {items.map((item, i) => (
          <Fragment key={item.id}>
            {item.parentId
              ? (
                <><div />
                  <div className='pb-1 mb-1'>
                    <CommentFlat item={item} noReply includeParent clickToContext />
                  </div>
                </>)
              : (item.isJob
                  ? <ItemJob item={item} rank={rank && i + 1} />
                  : <Item item={item} rank={rank && i + 1} />)}
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
