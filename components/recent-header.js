import { ITEM_TYPES } from '../lib/constants'
import { Form, Select } from './form'
import { useRouter } from 'next/router'

export default function RecentHeader ({ type, sub }) {
  const router = useRouter()
  const prefix = sub ? `/~${sub}` : ''

  const items = ITEM_TYPES(sub)

  return (
    <Form
      initial={{
        type: router.query.type || type || 'posts'
      }}
    >
      <div className='text-muted font-weight-bold mt-0 mb-3 d-flex justify-content-end align-items-center'>
        <Select
          groupClassName='mb-0 ml-2'
          className='w-auto'
          name='type'
          size='sm'
          items={items}
          onChange={(formik, e) => router.push(prefix + (e.target.value === 'posts' ? '/recent' : `/recent/${e.target.value}`))}
        />
      </div>
    </Form>
  )
}
