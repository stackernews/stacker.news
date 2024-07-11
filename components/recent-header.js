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
  return (
    <div className='text-muted fw-bold my-1 d-flex justify-content-start align-items-center'>
      <Select
        groupClassName='mb-2'
        className='w-auto'
        name='type'
        size='sm'
        value={type}
        items={items}
        noForm
        onChange={(_, e) => router.push(prefix + (e.target.value === 'posts' ? '/recent' : `/recent/${e.target.value}`))}
      />
    </div>
  )
}
