import { gql, useQuery } from '@apollo/client'
import React from 'react'
import Item from './item'
import styles from './items.module.css'

export default function Items () {
  const { loading, error, data } = useQuery(
    gql`
      { items {
        id
        createdAt
        title
        url
        user {
          name
        }
        sats
        ncomments
      } }`
  )
  if (error) return <div>Failed to load</div>
  if (loading) return <div>Loading...</div>
  const { items } = data
  return (
    <div className={styles.grid}>
      {items.map((item, i) => (
        <React.Fragment key={item.id}>
          <div className={styles.rank} key={item.id}>
            {i + 1}
          </div>
          <Item item={item} />
        </React.Fragment>
      ))}
    </div>
  )
}
