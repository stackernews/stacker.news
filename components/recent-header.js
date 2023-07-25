import { ITEM_TYPES } from '../lib/constants'
import { Select } from './form'
import { useRouter } from 'next/router'

export default function RecentHeader ({ type, sub }) {
  const router = useRouter()
  const prefix = sub ? `/~${sub}` : ''

  const items = ITEM_TYPES(sub)

  type ||= router.query.type || type || 'posts'
  return (
    <div className='text-muted fw-bold mt-0 mb-3 d-flex justify-content-end align-items-center'>
      <Select
        groupClassName='mb-0 ms-2'
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
