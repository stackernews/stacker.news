import { useRouter } from 'next/router'
import { Select, DatePicker } from './form'
import { WHENS_CUSTOM as WHENS } from '../lib/constants'
import { useState } from 'react'

export function UsageHeader () {
  const yesterday = new Date(Date.now() - 8.64e7)
  const router = useRouter()

  const select = async values => {
    const { when, ...query } = values

    if (when !== 'custom') { delete query.from; delete query.to }
    if (query.from && !query.to) return

    await router.push({
      pathname: `/stackers/${when}`,
      query
    })
  }

  const when = router.query.when
  const from = router.query.from || yesterday.toISOString()
  const to = router.query.to || yesterday.toISOString()

  const [datePicker, setDatePicker] = useState(when === 'custom' && router.query.when === 'custom')
  // The following state is needed for the date picker (and driven by the date picker).
  // Substituting router.query or formik values would cause network lag and/or timezone issues.
  const [range, setRange] = useState({ start: new Date(from), end: new Date(to) })

  return (
    <div className='text-muted fw-bold my-0 d-flex align-items-center flex-wrap'>
      <div className='text-muted fw-bold my-2 d-flex align-items-center'>
        stacker analytics for
        <Select
          groupClassName='mb-0 mx-2'
          className='w-auto'
          name='when'
          size='sm'
          items={WHENS}
          value={router.query.when || 'day'}
          noForm
          onChange={(formik, e) => {
            select({ ...formik?.values, when: e.target.value, from: from || yesterday.toISOString(), to: to || yesterday.toISOString() })
            setDatePicker(e.target.value === 'custom')
            if (e.target.value === 'custom') setRange({ start: yesterday, end: yesterday })
          }}
        />
      </div>
      {datePicker &&
        <DatePicker
          noForm
          fromName='from' toName='to'
          className='form-control p-0 px-2 mb-0 text-center'
          onMount={() => {
            setRange({ start: new Date(from), end: new Date(to) })
            return [from, to]
          }}
          onChange={(formik, [start, end], e) => {
            setRange({ start, end })
            select({ ...formik?.values, when, from: start && start.toISOString(), to: end && end.toISOString() })
          }}
          selected={range.start}
          startDate={range.start} endDate={range.end}
          selectsRange
          dateFormat='MM/dd/yy'
          maxDate={yesterday}
          minDate={new Date('2021-05-01')}
        />}
    </div>
  )
}
