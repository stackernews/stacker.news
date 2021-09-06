import { useQuery } from '@apollo/client'
import Button from 'react-bootstrap/Button'
import Item, { ItemSkeleton } from './item'
import styles from './items.module.css'
import { MORE_ITEMS } from '../fragments/items'
import { useState } from 'react'
import { useRouter } from 'next/router'

export default function Items ({ variables, rank }) {
  const router = useRouter()
  const { error, data, fetchMore } = useQuery(MORE_ITEMS, {
    variables,
    fetchPolicy: router.query.cache ? 'cache-first' : undefined
  })
  if (error) return <div>Failed to load!</div>
  if (!data) {
    return <ItemsSkeleton rank={rank} />
  }

  const { moreItems: { items, cursor } } = data
  return (
    <>
      <div className={styles.grid}>
        {items.map((item, i) => (
          <Item item={item} rank={rank && i + 1} key={item.id} />
        ))}
      </div>
      <MoreFooter cursor={cursor} fetchMore={fetchMore} offset={items.length} rank={rank} />
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

function MoreFooter ({ cursor, fetchMore, rank, offset }) {
  const [loading, setLoading] = useState(false)

  if (loading) {
    return <ItemsSkeleton rank={rank} startRank={offset} />
  }

  let Footer
  if (cursor) {
    Footer = () => (
      <Button
        variant='primary'
        size='md'
        onClick={async () => {
          setLoading(true)
          await fetchMore({
            variables: {
              cursor
            }
          })
          setLoading(false)
        }}
      >more
      </Button>
    )
  } else {
    Footer = () => (
      <div className='text-muted' style={{ fontFamily: 'lightning', fontSize: '2rem', opacity: '0.6' }}>GENISIS</div>
    )
  }

  return <div className='d-flex justify-content-center mt-4 mb-2'><Footer /></div>
}
