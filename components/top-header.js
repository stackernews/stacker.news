import { useRouter } from 'next/router'
import { useState } from 'react'
import { Form, Select, DatePicker } from './form'
import { ITEM_SORTS, USER_SORTS, WHENS, WHENS_CUSTOM } from '../lib/constants'

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
          (what !== 'stackers' && (query.by === 'zaprank' || !ITEM_SORTS.includes(query.by)))) {
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
  const by = router.query.by || (what === 'stackers' ? 'stacked' : 'zaprank')
  const when = router.query.when || ''
  const from = router.query.from || new Date().toISOString()
  const to = router.query.to || new Date().toISOString()

  const [datePicker, setDatePicker] = useState(when === 'custom' && router.query.when === 'custom')
  // The following state is needed for the date picker (and driven by the date picker).
  // Substituting router.query or formik values would cause network lag and/or timezone issues.
  const [range, setRange] = useState({ start: new Date(from), end: new Date(to) })

  return (
    <div className='d-flex'>
      <Form
        className='me-auto'
        initial={{ what, by, when }}
        onSubmit={top}
      >
        <div className='text-muted fw-bold my-3 d-flex align-items-center flex-wrap pb-2'>
          <div className='text-muted fw-bold my-3 d-flex align-items-center pb-2'>
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
                  groupClassName='mb-0 mx-2'
                  onChange={(formik, e) => {
                    top({ ...formik?.values, when: e.target.value, from: from || new Date().toISOString(), to: to || new Date().toISOString() })
                    setDatePicker(e.target.value === 'custom')
                    if (e.target.value === 'custom') setRange({ start: new Date(), end: new Date() })
                  }}
                  name='when'
                  size='sm'
                  overrideValue={when}
                  items={cat !== 'stackers' ? WHENS_CUSTOM : WHENS}
                />
              </>}

          </div>
          {datePicker &&
            <DatePicker
              fromName='from' toName='to'
              className='form-control p-0 px-2 mb-2 text-center'
              onMount={() => {
                setRange({ start: new Date(from), end: new Date(to) })
                return [from, to]
              }}
              onChange={(formik, [start, end], e) => {
                setRange({ start, end })
                top({ ...formik?.values, from: start && start.toISOString(), to: end && end.toISOString() })
              }}
              selected={range.start}
              startDate={range.start} endDate={range.end}
              selectsRange
              dateFormat='MM/dd/yy'
              maxDate={new Date()}
              minDate={new Date('2021-05-01')}
            />}
        </div>
      </Form>
    </div>
  )
}
