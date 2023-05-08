import { ITEM } from '../../../fragments/items'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import { DiscussionForm } from '../../../components/discussion-form'
import { LinkForm } from '../../../components/link-form'
import LayoutCenter from '../../../components/layout-center'
import JobForm from '../../../components/job-form'
import { PollForm } from '../../../components/poll-form'
import { BountyForm } from '../../../components/bounty-form'

export const getServerSideProps = getGetServerSideProps(ITEM, null,
  data => !data.item)

export default function PostEdit ({ data: { item } }) {
  const editThreshold = new Date(item.createdAt).getTime() + 10 * 60000

  return (
    <LayoutCenter sub={item.subName}>
      {item.isJob
        ? <JobForm item={item} />
        : (item.url
            ? <LinkForm item={item} editThreshold={editThreshold} adv />
            : (item.pollCost
                ? <PollForm item={item} editThreshold={editThreshold} adv />
                : (item.bounty
                    ? <BountyForm item={item} editThreshold={editThreshold} adv />
                    : <DiscussionForm item={item} editThreshold={editThreshold} adv />)))}
    </LayoutCenter>
  )
}
