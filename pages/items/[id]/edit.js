import { ITEM } from '@/fragments/items'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { DiscussionForm } from '@/components/discussion-form'
import { LinkForm } from '@/components/link-form'
import { CenterLayout } from '@/components/layout'
import JobForm from '@/components/job-form'
import { PollForm } from '@/components/poll-form'
import { BountyForm } from '@/components/bounty-form'
import { useState } from 'react'
import { useQuery, gql } from '@apollo/client'
import { useRouter } from 'next/router'
import PageLoading from '@/components/page-loading'
import { FeeButtonProvider, postCommentBaseLineItems } from '@/components/fee-button'
import SubSelect from '@/components/sub-select'
import useCanEdit from '@/components/use-can-edit'
import { useMe } from '@/components/me'

export const getServerSideProps = getGetServerSideProps({
  query: ITEM,
  notFound: data => !data.item
})

const SUB_BASECOST = gql`
  query Sub($name: String!) {
    sub(name: $name) {
      name
      baseCost
    }
  }
`

export default function PostEdit ({ ssrData }) {
  const router = useRouter()
  const { data } = useQuery(ITEM, { variables: { id: router.query.id } })
  if (!data && !ssrData) return <PageLoading />

  const { item } = data || ssrData
  const { me } = useMe()
  const [sub, setSub] = useState(item.subName)

  // we need to fetch the new sub to calculate the cost difference
  const { data: newSubData } = useQuery(SUB_BASECOST, { variables: { name: sub } })

  const [,, editThreshold] = useCanEdit(item)

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

  const editLineItems = (newSub) => {
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

    const isSwitchingSub = item.subName !== newSub?.name
    const subCostDifference = isSwitchingSub && {
      ...postCommentBaseLineItems({
        baseCost: Math.max(0, (newSub?.baseCost ?? 0) - (item?.sub?.baseCost ?? 0)),
        me: !!me
      })
    }

    return {
      ...subCostDifference,
      ...existingBoostLineItem
    }
  }

  return (
    <CenterLayout sub={sub}>
      <FeeButtonProvider baseLineItems={editLineItems(newSubData?.sub)}>
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
