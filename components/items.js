import { useQuery } from '@apollo/client'
import Item, { ItemSkeleton } from './item'
import ItemJob from './item-job'
import styles from './items.module.css'
import MoreFooter from './more-footer'
import { Fragment, useCallback, useMemo } from 'react'
import { CommentFlat } from './comment'
import { SUB_ITEMS } from '@/fragments/subs'
import { LIMIT } from '@/lib/cursor'
import ItemFull from './item-full'
import { useData } from './use-data'

const DEFAULT_FILTER = () => true
const DEFAULT_VARIABLES = {}

export default function Items ({ ssrData, variables = DEFAULT_VARIABLES, query, destructureData, rank, noMoreText, Footer, filter = DEFAULT_FILTER }) {
  const { data, fetchMore } = useQuery(query || SUB_ITEMS, { variables })
  const Foooter = Footer || MoreFooter
  const dat = useData(data, ssrData)

  const { items, pins, ad, cursor } = useMemo(() => {
    if (!dat) return {}
    if (destructureData) {
      return destructureData(dat)
    } else {
      return dat?.items
    }
  }, [dat])

  const itemsWithPins = useMemo(() => {
    if (!pins) return items

    const res = [...items]
    pins?.forEach(p => {
      if (p.position <= res.length) {
        res.splice(p.position - 1, 0, p)
      } else {
        res.push(p)
      }
    })
    return res
  }, [pins, items])

  const Skeleton = useCallback(() =>
    <ItemsSkeleton rank={rank} startRank={items?.length} limit={variables.limit} Footer={Foooter} />, [rank, items])

  if (!dat) {
    return <Skeleton />
  }

  const isHome = !variables?.sub

  return (
    <>
      <div className={styles.grid}>
        {ad && <ListItem item={ad} ad />}
        {itemsWithPins.filter(filter).map((item, i) => (
          <ListItem key={`${item.id}-${i + 1}`} item={item} rank={rank && i + 1} itemClassName={variables.includeComments ? 'py-2' : ''} pinnable={isHome ? false : pins?.length > 0} />
        ))}
      </div>
      <Foooter
        cursor={cursor} fetchMore={fetchMore} noMoreText={noMoreText}
        count={items?.length}
        Skeleton={Skeleton}
      />
    </>
  )
}

export function ListItem ({ item, ...props }) {
  return (
    item.parentId
      ? <CommentFlat item={item} noReply includeParent {...props} />
      : (item.isJob
          ? <ItemJob item={item} />
          : (item.searchText
              ? <ItemFull item={item} noReply {...props} />
              : <Item item={item} {...props} />))
  )
}

export function ItemsSkeleton ({ rank, startRank = 0, limit = LIMIT, Footer }) {
  const items = new Array(limit).fill(null)

  return (
    <>
      <div className={styles.grid}>
        {items.map((_, i) => (
          <ItemSkeleton rank={rank && i + startRank + 1} key={i + startRank} />
        ))}
      </div>
      <Footer invisible cursor />
    </>
  )
}
