import { useQuery } from '@apollo/client'
import Item, { ItemSkeleton } from './item'
import styles from './items.module.css'
import { MORE_ITEMS } from '../fragments/items'
import { useRouter } from 'next/router'
import MoreFooter from './more-footer'

export default function Items ({ variables, rank, items, cursor }) {
  const router = useRouter()
  const { data, fetchMore } = useQuery(MORE_ITEMS, {
    variables,
    fetchPolicy: router.query.cache ? 'cache-first' : undefined
  })

  if (!data && !items) {
    return <ItemsSkeleton rank={rank} />
  }

  if (data) {
    ({ moreItems: { items, cursor } } = data)
  }

  return (
    <>
      <div className={styles.grid}>
        {items.map((item, i) => (
          <Item item={item} rank={rank && i + 1} key={item.id} />
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
