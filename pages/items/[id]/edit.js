import { ITEM } from '../../../fragments/items'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import { DiscussionForm } from '../../../components/discussion-form'
import { LinkForm } from '../../../components/link-form'
import LayoutCenter from '../../../components/layout-center'
import JobForm from '../../../components/job-form'
import { PollForm } from '../../../components/poll-form'
import { BountyForm } from '../../../components/bounty-form'
import SubSelect from '../../../components/sub-select-form'
import { useState } from 'react'

export const getServerSideProps = getGetServerSideProps(ITEM, null,
  data => !data.item)

export default function PostEdit ({ data: { item } }) {
  const editThreshold = new Date(item.createdAt).getTime() + 10 * 60000
  const [sub, setSub] = useState(item.subName)

  let FormType = DiscussionForm
  if (item.isJob) {
    FormType = JobForm
  } else if (item.url) {
    FormType = LinkForm
  } else if (item.pollCost) {
    FormType = PollForm
  } else if (item.bounty) {
    FormType = BountyForm
  }

  return (
    <LayoutCenter sub={sub}>
      <FormType item={item} editThreshold={editThreshold}>
        {!item.isJob && <SubSelect label='sub' item={item} setSub={setSub} sub={sub} />}
      </FormType>
    </LayoutCenter>
  )
}
