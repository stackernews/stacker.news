import { useQuery } from '@apollo/client'
import Link from 'next/link'
import { RELATED_ITEMS } from '../fragments/items'
import AccordianItem from './accordian-item'
import Item, { ItemSkeleton } from './item'
import styles from './items.module.css'

export default function Related ({ title, itemId }) {
  const emptyItems = new Array(5).fill(null)
  const { data, loading } = useQuery(RELATED_ITEMS, {
    fetchPolicy: 'cache-first',
    variables: { title, id: itemId, limit: 5 }
  })

  let items, cursor
  if (data) {
    ({ related: { items, cursor } } = data)
  }

  return (
    <AccordianItem
      header={<div className='font-weight-bold'>related</div>}
      body={
        <>
          <div className={styles.grid}>
            {loading
              ? emptyItems.map((_, i) => <ItemSkeleton key={i} />)
              : (items?.length
                  ? items.map(item => <Item key={item.id} item={item} />)
                  : <div className='text-muted' style={{ fontFamily: 'lightning', fontSize: '2rem', opacity: '0.75' }}>EMPTY</div>
                )}
          </div>
          {cursor && itemId && <Link href={`/items/${itemId}/related`} passHref><a className='text-reset text-muted font-weight-bold'>view all related</a></Link>}
        </>
    }
    />
  )
}
