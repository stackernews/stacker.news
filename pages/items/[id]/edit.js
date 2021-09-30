import { ITEM_FIELDS } from '../../../fragments/items'
import { gql } from '@apollo/client'
import ApolloClient from '../../../api/client'
import { DiscussionForm } from '../../../components/discussion-form'
import { LinkForm } from '../../../components/link-form'
import LayoutCenter from '../../../components/layout-center'

export async function getServerSideProps ({ req, params: { id } }) {
  const { error, data: { item } } = await (await ApolloClient(req)).query({
    query:
      gql`
        ${ITEM_FIELDS}
        {
          item(id: ${id}) {
            ...ItemFields
            text
        }
      }`
  })

  if (error || !item) {
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

export default function PostEdit ({ item }) {
  const editThreshold = new Date(item.createdAt).getTime() + 10 * 60000

  return (
    <LayoutCenter>
      {item.url
        ? <LinkForm item={item} editThreshold={editThreshold} />
        : <DiscussionForm item={item} editThreshold={editThreshold} />}
    </LayoutCenter>
  )
}
