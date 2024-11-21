import { ITEM_TYPES, ITEM_TYPES_UNIVERSAL } from '@/lib/constants'
import { Select } from './form'
import { useRouter } from 'next/router'

export default function RecentHeader ({ type, sub }) {
  const router = useRouter()

  const prefix = sub ? `/~${sub.name}` : ''

  const items = sub
    ? ITEM_TYPES_UNIVERSAL.concat(sub.postTypes.map(p =>
      ['LINK', 'DISCUSSION', 'POLL', 'JOB'].includes(p) ? `${p.toLowerCase()}s` : 'bounties'
    ))
    : ITEM_TYPES

  type ||= router.query.type || type || 'posts'
  const subType = router.query.subType || 'all'

  return (
    <div className='text-muted fw-bold my-1 d-flex justify-content-start align-items-center'>
      <Select
        groupClassName='me-2 mb-0'
        className='w-auto'
        name='type'
        size='sm'
        value={type}
        items={items}
        noForm
        onChange={(_, e) => router.push(prefix + (e.target.value === 'posts' ? '/recent' : `/recent/${e.target.value}`))}
      />

      {type === 'bounties' && (
        <Select
          groupClassName='mx-2 mb-0'
          className='w-auto'
          name='subType'
          size='sm'
          value={subType}
          items={['all', 'paid', 'unpaid']}
          noForm
          onChange={(_, e) => router.push({ pathname: '/recent/bounties', query: e.target.value === 'all' ? undefined : { subType: e.target.value } })}
        />
      )}
    </div>
  )
}
