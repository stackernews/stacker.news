import { useQuery } from '@apollo/client'
import Item, { ItemSkeleton } from './item'
import styles from './items.module.css'

export default function Items ({ query, rank }) {
  const { loading, error, data } = useQuery(query)
  if (error) return <div>Failed to load!</div>
  if (loading) {
    const items = new Array(20).fill(null)

    return (
      <div className={styles.grid}>
        {items.map((_, i) => (
          <ItemSkeleton rank={i + 1} key={i} />
        ))}
      </div>
    )
  }

  const { items } = data
  return (
    <div className={styles.grid}>
      {items.map((item, i) => (
        <Item item={item} rank={rank && i + 1} key={item.id} />
      ))}
    </div>
  )
}
