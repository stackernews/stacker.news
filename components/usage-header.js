import { useRouter } from 'next/router'
import { Form, Select } from './form'

export function UsageHeader () {
  const router = useRouter()

  return (
    <Form
      initial={{
        when: router.query.when || 'day'
      }}
    >
      <div className='text-muted font-weight-bold my-3 d-flex align-items-center'>
        user analytics for
        <Select
          groupClassName='mb-0 ml-2'
          className='w-auto'
          name='when'
          size='sm'
          items={['day', 'week', 'month', 'year', 'forever']}
          onChange={(formik, e) => router.push(`/users/${e.target.value}`)}
        />
      </div>
    </Form>
  )
}
