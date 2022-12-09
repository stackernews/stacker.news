import { useRouter } from 'next/router'
import React from 'react'
import { ignoreClick } from '../lib/clicks'
import Comment from './comment'
import Item from './item'
import ItemJob from './item-job'
import { ItemsSkeleton } from './items'
import styles from './items.module.css'
import MoreFooter from './more-footer'

export default function MixedItems ({ rank, items, cursor, fetchMore }) {
  const router = useRouter()
  return (
    <>
      <div className={styles.grid}>
        {items.map((item, i) => (
          <React.Fragment key={item.id}>
            {item.parentId
              ? (
                <><div />
                  <div
                    className='pb-1 mb-1 clickToContext' onClick={e => {
                      if (ignoreClick(e)) {
                        return
                      }
                      router.push({
                        pathname: '/items/[id]',
                        query: { id: item.root.id, commentId: item.id }
                      }, `/items/${item.root.id}`)
                    }}
                  >
                    <Comment item={item} noReply includeParent clickToContext />
                  </div>
                </>)
              : (item.isJob
                  ? <ItemJob item={item} rank={rank && i + 1} />
                  : <Item item={item} rank={rank && i + 1} />)}
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
