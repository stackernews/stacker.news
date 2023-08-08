import { useRouter } from 'next/router'
import { Form, Select } from './form'
import { ITEM_SORTS, USER_SORTS, WHENS } from '../lib/constants'

export default function TopHeader ({ sub, cat }) {
  const router = useRouter()

  const top = async values => {
    const { what, when, ...query } = values

    if (what === 'cowboys') {
      await router.push({
        pathname: `/top/${what}`
      })
      return
    }

    const prefix = sub ? `/~${sub}` : ''

    if (typeof query.by !== 'undefined') {
      if (query.by === '' ||
          (what === 'stackers' && (query.by === 'stacked' || !USER_SORTS.includes(query.by))) ||
          (what !== 'stackers' && (query.by === 'votes' || !ITEM_SORTS.includes(query.by)))) {
        delete query.by
      }
    }

    await router.push({
      pathname: `${prefix}/top/${what}/${when || 'day'}`,
      query
    })
  }

  const what = cat
  const by = router.query.by || (what === 'stackers' ? 'stacked' : 'votes')
  const when = router.query.when || ''

  return (
    <div className='d-flex'>
      <Form
        className='me-auto'
        initial={{ what, by, when }}
        onSubmit={top}
      >
        <div className='text-muted fw-bold my-3 d-flex align-items-center'>
          top
          <Select
            groupClassName='mx-2 mb-0'
            onChange={(formik, e) => top({ ...formik?.values, what: e.target.value })}
            name='what'
            size='sm'
            overrideValue={what}
            items={router?.query?.sub ? ['posts', 'comments'] : ['posts', 'comments', 'stackers', 'cowboys']}
          />
          {cat !== 'cowboys' &&
            <>
              by
              <Select
                groupClassName='mx-2 mb-0'
                onChange={(formik, e) => top({ ...formik?.values, by: e.target.value })}
                name='by'
                size='sm'
                overrideValue={by}
                items={cat === 'stackers' ? USER_SORTS : ITEM_SORTS}
              />
              for
              <Select
                groupClassName='mb-0 ms-2'
                onChange={(formik, e) => top({ ...formik?.values, when: e.target.value })}
                name='when'
                size='sm'
                overrideValue={when}
                items={WHENS}
              />
            </>}

        </div>
      </Form>
    </div>
  )
}
