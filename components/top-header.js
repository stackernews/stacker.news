import { useRouter } from 'next/router'
import { Form, Select, DatePicker } from './form'
import { ITEM_SORTS, SUB_SORTS, USER_SORTS, WHENS } from '@/lib/constants'
import { whenToFrom } from '@/lib/time'

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
          (what === 'stackers' && (query.by === 'stacking' || !USER_SORTS.includes(query.by))) ||
          (what === 'territories' && (query.by === 'stacking' || !SUB_SORTS.includes(query.by))) ||
          (['posts', 'comments'].includes(what) && (query.by === 'zaprank' || !ITEM_SORTS.includes(query.by)))) {
        delete query.by
      }
    }
    if (when !== 'custom') { delete query.from; delete query.to }
    if (query.from && !query.to) return

    await router.push({
      pathname: `${prefix}/top/${what}/${when || 'day'}`,
      query
    })
  }

  const what = cat
  const by = router.query.by || (what === 'stackers' ? 'value' : what === 'territories' ? 'stacking' : 'zaprank')
  const when = router.query.when || ''

  return (
    <div className='d-flex'>
      <Form
        className='me-auto'
        initial={{ what, by, when, from: '', to: '' }}
        onSubmit={top}
      >
        <div className='text-muted fw-bold my-1 d-flex align-items-center flex-wrap'>
          <div className='text-muted fw-bold mb-2 d-flex align-items-center'>
            <Select
              groupClassName='me-2 mb-0'
              onChange={(formik, e) => top({ ...formik?.values, what: e.target.value })}
              name='what'
              size='sm'
              overrideValue={what}
              items={router?.query?.sub ? ['posts', 'comments'] : ['posts', 'comments', 'stackers', 'cowboys', 'territories']}
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
                  items={sortItemsForCategory(cat)}
                />
                for
                <Select
                  groupClassName='mb-0 mx-2'
                  onChange={(formik, e) => {
                    const range = e.target.value === 'custom' ? { from: whenToFrom(when), to: Date.now() } : {}
                    top({ ...formik?.values, when: e.target.value, ...range })
                  }}
                  name='when'
                  size='sm'
                  overrideValue={when}
                  items={WHENS}
                />
              </>}

          </div>
          {when === 'custom' &&
            <DatePicker
              fromName='from'
              toName='to'
              className='p-0 px-2'
              onChange={(formik, [from, to], e) => {
                top({ ...formik?.values, from: from.getTime(), to: to.getTime() })
              }}
              from={router.query.from}
              to={router.query.to}
              when={when}
            />}
        </div>
      </Form>
    </div>
  )
}

function sortItemsForCategory (cat) {
  switch (cat) {
    case 'stackers':
      return USER_SORTS
    case 'territories':
      return SUB_SORTS
    default:
      return ITEM_SORTS
  }
}
