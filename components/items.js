import { useQuery } from '@apollo/client'
import Item, { ItemSkeleton } from './item'
import ItemJob from './item-job'
import styles from './items.module.css'
import MoreFooter from './more-footer'
import { Fragment, useCallback, useMemo } from 'react'
import { CommentFlat } from './comment'
import { SUB_ITEMS } from '../fragments/subs'
import { LIMIT } from '../lib/cursor'
import ItemFull from './item-full'
import { useData } from './use-data'

export default function Items ({ ssrData, variables = {}, query, destructureData, rank, noMoreText, Footer, filter = () => true }) {
  const { data, fetchMore } = useQuery(query || SUB_ITEMS, { variables })
  const Foooter = Footer || MoreFooter
  const dat = useData(data, ssrData)

  const { items, pins, cursor } = useMemo(() => {
    if (!dat) return {}
    if (destructureData) {
      return destructureData(dat)
    } else {
      return dat?.items
    }
  }, [dat])

  const pinMap = useMemo(() =>
    pins?.reduce((a, p) => { a[p.position] = p; return a }, {}), [pins])

  const Skeleton = useCallback(() =>
    <ItemsSkeleton rank={rank} startRank={items?.length} limit={variables.limit} Footer={Foooter} />, [rank, items])

  if (!dat) {
    return <Skeleton />
  }

  // keep track of pins
  let remainingPins = pinMap ? Object.values(pinMap) : []

  const mergePins = (item, i) => {
    // we loop over unpinned items here.
    // we will use this array to return pins together with the current item.
    const items = []
    // current position in feed (excluding pins)
    let position = i + 1
    let pin = pinMap?.[position]
    // make sure this pin wasn't already inserted
    let notInserted = pin ? remainingPins.some(({ id }) => id === pin?.id) : undefined
    // insert all consecutive pins at this position
    while (pin && notInserted) {
      remainingPins = remainingPins.filter(({ id }) => id !== pin.id)
      items.push(<Item key={`pin-${position}`} item={pin} />)
      pin = pinMap[++position]
      notInserted = pin ? remainingPins.some(({ id }) => id === pin.id) : undefined
    }

    // add "normal" item after pins
    items.push(<ListItem key={`item-${item.id}`} item={item} rank={rank && i + 1} siblingComments={variables.includeComments} />)

    return (
      <Fragment key={item.id}>
        {items}
      </Fragment>
    )
  }

  return (
    <>
      <div className={styles.grid}>
        {items.filter(filter).map(mergePins)}
        {remainingPins.map((item, i) => <Item key={item.id} item={item} />)}
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
      ? <CommentFlat item={item} noReply includeParent clickToContext {...props} />
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
