import React from 'react'
import { useQuery } from '@apollo/client'
import AccordianItem from './accordian-item'
import Item, { ItemSkeleton } from './item'
import { BOUNTY_ITEMS_BY_USER } from '../fragments/items'
import Link from 'next/link'
import styles from './items.module.css'

export default function PastBounties ({ children, item }) {
  const emptyItems = new Array(5).fill(null)

  const { data, loading } = useQuery(BOUNTY_ITEMS_BY_USER, {
    variables: {
      id: Number(item.user.id)
    },
    fetchPolicy: 'cache-first'
  })

  let items
  if (data) {
    ({ getBountiesByUser: items } = data)
  }

  return (
      <AccordianItem
      header={<div className='font-weight-bold'>past bounties</div>}
      body={
        <>
        <div className={styles.grid}>
          {loading
            ? emptyItems.map((_, i) => <ItemSkeleton key={i} />)
            : (items?.length
                ? items.map(bountyItem => {
                  if (bountyItem.id === item.id) {
                    return null
                  }
                  return <Item key={bountyItem.id} item={bountyItem} />
                })
                : <div className='text-muted' style={{ fontFamily: 'lightning', fontSize: '2rem', opacity: '0.75' }}>EMPTY</div>
              )}
        </div>
        {
        item.user.name && <Link href={`/${item.user.name}/bounties`} query={{ parent: item }} passHref><a className='text-reset text-muted font-weight-bold'>view all past bounties</a></Link>}
      </>}
      />
  )
}
