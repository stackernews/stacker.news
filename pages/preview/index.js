import ApolloClient from '../../api/client'
import { MORE_ITEMS } from '../../fragments/items'
import Item from '../../components/item'
import styles from '../../components/items.module.css'
import LayoutPreview from '../../components/layout-preview'
import { LightningProvider } from '../../components/lightning'

// we can't SSR on the normal page because we'd have to hyrdate the cache
// on the client which is a lot of work, i.e. a bit fat todo
export async function getServerSideProps ({ params }) {
  // grab the item on the server side
  const { error, data: { moreItems: { items } } } = await (await ApolloClient()).query({
    query: MORE_ITEMS,
    variables: { sort: 'hot' }
  })

  if (!items || error) {
    return {
      notFound: true
    }
  }

  return {
    props: {
      items
    }
  }
}

export default function IndexPreview ({ items }) {
  return (
    <>
      <LayoutPreview>
        <LightningProvider>
          <div className={styles.grid}>
            {items.map((item, i) => (
              <Item item={item} rank={i + 1} key={item.id} />
            ))}
          </div>
        </LightningProvider>
      </LayoutPreview>
    </>
  )
}
