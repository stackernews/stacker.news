import { ITEM } from '../../../fragments/items'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import { DiscussionForm } from '../../../components/discussion-form'
import { LinkForm } from '../../../components/link-form'
import LayoutCenter from '../../../components/layout-center'
import JobForm from '../../../components/job-form'

export const getServerSideProps = getGetServerSideProps(ITEM, null,
  data => !data.item)

export default function PostEdit ({ data: { item } }) {
  const editThreshold = new Date(item.createdAt).getTime() + 10 * 60000

  return (
    <LayoutCenter sub={item.sub?.name}>
      {item.maxBid
        ? <JobForm item={item} sub={item.sub} />
        : (item.url
            ? <LinkForm item={item} editThreshold={editThreshold} />
            : <DiscussionForm item={item} editThreshold={editThreshold} />)}
    </LayoutCenter>
  )
}
