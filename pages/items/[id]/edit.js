import { ITEM } from '@/fragments/items'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { DiscussionForm } from '@/components/discussion-form'
import { LinkForm } from '@/components/link-form'
import { CenterLayout } from '@/components/layout'
import JobForm from '@/components/job-form'
import { PollForm } from '@/components/poll-form'
import { BountyForm } from '@/components/bounty-form'
import { useEffect, useState } from 'react'
import { useLazyQuery, useQuery } from '@apollo/client'
import { useRouter } from 'next/router'
import PageLoading from '@/components/page-loading'
import { FeeButtonProvider } from '@/components/fee-button'
import { SubMultiSelect } from '@/components/sub-select'
import useCanEdit from '@/components/use-can-edit'
import { SUBS } from '@/fragments/subs'
import Countdown from '@/components/countdown'
import { subsDiff } from '@/lib/subs'

export const getServerSideProps = getGetServerSideProps({
  query: ITEM,
  notFound: data => !data.item
})

export default function PostEdit ({ ssrData }) {
  const router = useRouter()
  const { data } = useQuery(ITEM, { variables: { id: router.query.id } })
  const [fetchSubs] = useLazyQuery(SUBS)
  if (!data && !ssrData) return <PageLoading />

  const { item } = data || ssrData
  const [subs, setSubs] = useState(item.subNames)
  const [baseLineItems, setBaseLineItems] = useState({})

  useEffect(() => {
    const territoryAddPrefix = 'territory-add-'
    const addedSubs = subsDiff(subs, item.subNames)
    if (!addedSubs.length) {
      setBaseLineItems(prev => Object.entries(prev).reduce((acc, [key, value]) => {
        if (!key.startsWith(territoryAddPrefix)) {
          acc[key] = value
        }
        return acc
      }, {}))
      return
    }
    fetchSubs({ variables: { subNames: addedSubs } }).then(res => {
      setBaseLineItems(prev => {
        const newBaseLineItems = Object.entries(prev).reduce((acc, [key, value]) => {
          if (!key.startsWith(territoryAddPrefix)) {
            acc[key] = value
          }
          return acc
        }, {})
        const territoryAdds = res.data.subs.reduce((acc, sub) => ({
          ...acc,
          [`${territoryAddPrefix}${sub.name}`]: {
            label: `~${sub.name} post`,
            term: `+ ${sub.baseCost}`,
            op: '+',
            modifier: cost => cost + sub.baseCost
          }
        }), {})
        return {
          ...newBaseLineItems,
          ...territoryAdds
        }
      })
    })
  }, [subs])

  const [,, editThreshold] = useCanEdit(item)
  const EditInfo = editThreshold && item.payIn?.payInState === 'PAID'
    ? <div className='text-muted fw-bold font-monospace mt-1'><Countdown date={editThreshold} /></div>
    : null

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

  return (
    <CenterLayout>
      <FeeButtonProvider baseLineItems={baseLineItems}>
        <FormType item={item} subs={subs} EditInfo={EditInfo}>
          {!item.isJob &&
            <SubMultiSelect
              placeholder='pick territories'
              className='d-flex'
              size='md'
              label='territory'
              filterSubs={s => s.name !== 'jobs' && s.postTypes?.includes(itemType)}
              onChange={(_, e) => setSubs(e)}
              subs={subs}
            />}
        </FormType>
      </FeeButtonProvider>
    </CenterLayout>
  )
}
