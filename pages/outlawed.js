import Layout from '../components/layout'
import { ItemsSkeleton } from '../components/items'
import { getGetServerSideProps } from '../api/ssrApollo'
import { OUTLAWED_ITEMS } from '../fragments/items'
import { useQuery } from '@apollo/client'
import React from 'react'
import styles from '../components/items.module.css'
import MoreFooter from '../components/more-footer'
import Item from '../components/item'
import ItemJob from '../components/item-job'
import Comment from '../components/comment'
import { ignoreClick } from '../lib/clicks'
import { useRouter } from 'next/router'

export const getServerSideProps = getGetServerSideProps(OUTLAWED_ITEMS)

export default function Index ({ data: { outlawedItems: { items, cursor } } }) {
  return (
    <Layout>
      <Items
        items={items} cursor={cursor}
      />
    </Layout>
  )
}

function Items ({ rank, items, cursor }) {
  const { data, fetchMore } = useQuery(OUTLAWED_ITEMS)
  const router = useRouter()

  if (!data && !items) {
    return <ItemsSkeleton rank={rank} />
  }

  if (data) {
    ({ outlawedItems: { items, cursor } } = data)
  }

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
              : (item.maxBid
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
