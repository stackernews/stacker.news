import { useRouter } from 'next/router'
import { Select, DatePicker } from './form'
import { WHENS } from '@/lib/constants'
import { whenToFrom } from '@/lib/time'

export function UsageHeader ({ pathname = null }) {
  const router = useRouter()

  const path = pathname || 'stackers'

  const select = async values => {
    const { when, ...query } = values

    if (when !== 'custom') { delete query.from; delete query.to }
    if (query.from && !query.to) return

    await router.push({

      pathname: `/${path}/${when}`,
      query
    })
  }

  const when = router.query.when || 'day'

  return (
    <div className='text-muted fw-bold my-0 d-flex align-items-center flex-wrap'>
      <div className='text-muted fw-bold mb-2 d-flex align-items-center'>
        stacker analytics for
        <Select
          groupClassName='mb-0 mx-2'
          className='w-auto'
          name='when'
          size='sm'
          items={WHENS}
          value={when}
          noForm
          onChange={(formik, e) => {
            const range = e.target.value === 'custom' ? { from: whenToFrom(when), to: Date.now() } : {}
            select({ when: e.target.value, ...range })
          }}
        />
      </div>
      {when === 'custom' &&
        <DatePicker
          noForm
          fromName='from'
          toName='to'
          className='p-0 px-2 mb-0'
          onChange={(formik, [from, to], e) => {
            select({ when, from: from.getTime(), to: to.getTime() })
          }}
          from={router.query.from}
          to={router.query.to}
          when={when}
        />}
    </div>
  )
}
