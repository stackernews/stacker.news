import { ITEM } from '../../../fragments/items'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import { DiscussionForm } from '../../../components/discussion-form'
import { LinkForm } from '../../../components/link-form'
import { CenterLayout } from '../../../components/layout'
import JobForm from '../../../components/job-form'
import { PollForm } from '../../../components/poll-form'
import { BountyForm } from '../../../components/bounty-form'
import SubSelect from '../../../components/sub-select-form'
import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'
import PageLoading from '../../../components/page-loading'

export const getServerSideProps = getGetServerSideProps(ITEM, null,
  data => !data.item)

export default function PostEdit ({ ssrData }) {
  const router = useRouter()
  const { data } = useQuery(ITEM, { variables: { id: router.query.id } })
  if (!data && !ssrData) return <PageLoading />

  const { item } = data || ssrData
  const [sub, setSub] = useState(item.subName)

  const editThreshold = new Date(item.createdAt).getTime() + 10 * 60000

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
    <CenterLayout sub={sub}>
      <FormType item={item} editThreshold={editThreshold}>
        {!item.isJob && <SubSelect label='sub' item={item} setSub={setSub} sub={sub} />}
      </FormType>
    </CenterLayout>
  )
}
