import { Form, Select } from './form'
import { useRouter } from 'next/router'

export default function RecentHeader ({ type }) {
  const router = useRouter()

  return (
    <Form
      initial={{
        type: router.query.type || type || 'posts'
      }}
    >
      <div className='text-muted font-weight-bold mt-1 mb-3 d-flex justify-content-end align-items-center'>
        <Select
          groupClassName='mb-0 ml-2'
          className='w-auto'
          name='type'
          size='sm'
          items={['posts', 'bounties', 'comments', 'links', 'discussions', 'polls', 'bios']}
          onChange={(formik, e) => router.push(e.target.value === 'posts' ? '/recent' : `/recent/${e.target.value}`)}
        />
      </div>
    </Form>
  )
}
