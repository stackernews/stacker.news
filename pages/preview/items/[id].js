import { gql } from '@apollo/client'
import ApolloClient from '../../../api/client'
import { ITEM_FIELDS } from '../../../fragments/items'
import Item from '../../../components/item'
import Text from '../../../components/text'
import LayoutPreview from '../../../components/layout-preview'
import { LightningProvider } from '../../../components/lightning'
import Comment from '../../../components/comment'

// we can't SSR on the normal page because we'd have to hyrdate the cache
// on the client which is a lot of work, i.e. a bit fat todo
export async function getServerSideProps ({ params }) {
  // grab the item on the server side
  const { error, data: { item } } = await (await ApolloClient()).query({
    query:
      gql`
      ${ITEM_FIELDS}
      {
        item(id: ${params.id}) {
          ...ItemFields
          text
      }
    }`
  })

  if (!item || error) {
    return {
      notFound: true
    }
  }

  return {
    props: {
      item
    }
  }
}

// export async function getStaticPaths () {
//   return {
//     paths: [],
//     // Enable statically generating additional pages
//     // For example: `/posts/3`
//     fallback: 'blocking'
//   }
// }

export default function ItemPreview ({ item }) {
  return (
    <>
      <LayoutPreview>
        <LightningProvider>

          {item.parentId
            ? <Comment item={item} includeParent noReply noComments />
            : (
              <Item item={item}>
                {item.text && <div className='mb-3'><Text>{item.text}</Text></div>}
              </Item>
              )}
        </LightningProvider>
      </LayoutPreview>
    </>
  )
}
