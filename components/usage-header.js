import { useRouter } from 'next/router'
import { Form, Select } from './form'
import { WHENS } from '../lib/constants'

export function UsageHeader () {
  const router = useRouter()

  return (
    <Form
      initial={{
        when: router.query.when || 'day'
      }}
    >
      <div className='text-muted fw-bold my-3 d-flex align-items-center'>
        stacker analytics for
        <Select
          groupClassName='mb-0 ms-2'
          className='w-auto'
          name='when'
          size='sm'
          items={WHENS}
          onChange={(formik, e) => router.push(`/stackers/${e.target.value}`)}
        />
      </div>
    </Form>
  )
}
