import { useRouter } from 'next/router'
import { Select } from './form'
import { WHENS } from '../lib/constants'

export function UsageHeader () {
  const router = useRouter()

  return (
    <div className='text-muted fw-bold my-3 d-flex align-items-center'>
      stacker analytics for
      <Select
        groupClassName='mb-0 ms-2'
        className='w-auto'
        name='when'
        size='sm'
        items={WHENS}
        value={router.query.when || 'day'}
        noForm
        onChange={(formik, e) => router.push(`/stackers/${e.target.value}`)}
      />
    </div>
  )
}
