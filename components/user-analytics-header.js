import { useRouter } from 'next/router'
import { Select, DatePicker } from './form'
import { WHENS } from '@/lib/constants'
import { whenToFrom } from '@/lib/time'
import { territoryHref } from '@/lib/navigation'
import SubSelect from './sub-select'

const PREPEND_SUBS = ['all']

export function UserAnalyticsHeader ({ pathname = null, label = 'for', sub }) {
  const router = useRouter()

  const path = pathname || 'satistics/graph'

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
    <div className='text-muted font-bold my-0 flex items-center flex-wrap'>
      <div className='text-muted font-bold mb-2 flex items-center'>
        {sub && (
          <>
            stacker analytics in
            <SubSelect
              sub={sub}
              prependSubs={PREPEND_SUBS}
              id='analytics-sub'
              aria-label='territory'
              groupClassName='mb-0 mx-2 min-w-0'
              className='w-auto max-w-36'
              onChange={(formik, e) => router.push(territoryHref(router.asPath, e.target.value))}
            />
          </>
        )}
        {label}
        <Select
          groupClassName={label ? 'mb-0 mx-2' : 'mb-0 me-2'}
          name='when'
          aria-label='time range'
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
