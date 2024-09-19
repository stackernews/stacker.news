import { ITEM } from '@/fragments/items'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { DiscussionForm } from '@/components/discussion-form'
import { LinkForm } from '@/components/link-form'
import { CenterLayout } from '@/components/layout'
import JobForm from '@/components/job-form'
import { PollForm } from '@/components/poll-form'
import { BountyForm } from '@/components/bounty-form'
import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'
import PageLoading from '@/components/page-loading'
import { FeeButtonProvider } from '@/components/fee-button'
import SubSelect from '@/components/sub-select'

export const getServerSideProps = getGetServerSideProps({
  query: ITEM,
  notFound: data => !data.item
})

export default function PostEdit ({ ssrData }) {
  const router = useRouter()
  const { data } = useQuery(ITEM, { variables: { id: router.query.id } })
  if (!data && !ssrData) return <PageLoading />

  const { item } = data || ssrData
  const [sub, setSub] = useState(item.subName)

  const editThreshold = new Date(item?.invoice?.confirmedAt ?? item.createdAt).getTime() + 10 * 60000

  let FormType = DiscussionForm
  let itemType = 'DISCUSSION'
  if (item.isJob) {
    FormType = JobForm
    itemType = 'JOB'
  } else if (item.url) {
    FormType = LinkForm
    itemType = 'LINK'
  } else if (item.pollCost) {
    FormType = PollForm
    itemType = 'POLL'
  } else if (item.bounty) {
    FormType = BountyForm
    itemType = 'BOUNTY'
  }

  const existingBoostLineItem = item.boost
    ? {
        existingBoost: {
          label: 'old boost',
          term: `- ${item.boost}`,
          op: '-',
          modifier: cost => cost - item.boost
        }
      }
    : undefined

  return (
    <CenterLayout sub={sub}>
      <FeeButtonProvider baseLineItems={existingBoostLineItem}>
        <FormType item={item} editThreshold={editThreshold}>
          {!item.isJob &&
            <SubSelect
              className='d-flex'
              size='medium'
              label='territory'
              filterSubs={s => s.name !== 'jobs' && s.postTypes?.includes(itemType)}
              onChange={(_, e) => setSub(e.target.value)}
              sub={sub}
            />}
        </FormType>
      </FeeButtonProvider>
    </CenterLayout>
  )
}
