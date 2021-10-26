import { ITEM } from '../../../fragments/items'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import { DiscussionForm } from '../../../components/discussion-form'
import { LinkForm } from '../../../components/link-form'
import LayoutCenter from '../../../components/layout-center'

export const getServerSideProps = getGetServerSideProps(ITEM, null, 'item')

export default function PostEdit ({ data: { item } }) {
  const editThreshold = new Date(item.createdAt).getTime() + 10 * 60000

  return (
    <LayoutCenter>
      {item.url
        ? <LinkForm item={item} editThreshold={editThreshold} />
        : <DiscussionForm item={item} editThreshold={editThreshold} />}
    </LayoutCenter>
  )
}
