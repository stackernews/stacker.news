import { useRouter } from 'next/router'
import { Form, Select } from './form'

export default function TopHeader ({ cat }) {
  const router = useRouter()

  const top = async values => {
    const what = values.what
    delete values.what
    if (values.sort === '') delete values.sort
    if (values.when === '') delete values.when
    await router.push({
      pathname: `/top/${what}`,
      query: values
    })
  }

  return (
    <div className='d-flex'>
      <Form
        className='mr-auto'
        initial={{
          what: cat,
          sort: router.query.sort || '',
          when: router.query.when || ''
        }}
        onSubmit={top}
      >
        <div className='text-muted font-weight-bold my-3 d-flex align-items-center'>
          top
          <Select
            groupClassName='mx-2 mb-0'
            onChange={(formik, e) => top({ ...formik?.values, what: e.target.value })}
            name='what'
            size='sm'
            items={['posts', 'comments', 'users']}
          />
          by
          <Select
            groupClassName='mx-2 mb-0'
            onChange={(formik, e) => top({ ...formik?.values, sort: e.target.value })}
            name='sort'
            size='sm'
            items={cat === 'users' ? ['stacked', 'spent', 'comments', 'posts'] : ['votes', 'comments', 'sats']}
          />
          for
          <Select
            groupClassName='mb-0 ml-2'
            onChange={(formik, e) => top({ ...formik?.values, when: e.target.value })}
            name='when'
            size='sm'
            items={['day', 'week', 'month', 'year', 'forever']}
          />
        </div>
      </Form>
    </div>
  )
}
