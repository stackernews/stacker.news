import { useRouter } from 'next/router'
import { Select, DatePicker } from './form'
import { useSubs, subSelectClasses } from './sub-select'
import { WHENS } from '@/lib/constants'
import { whenToFrom } from '@/lib/time'

export function SubAnalyticsHeader ({ pathname = null }) {
  const router = useRouter()

  const path = pathname || 'stackers'

  const select = async values => {
    const { sub, when, ...query } = values

    if (when !== 'custom') { delete query.from; delete query.to }
    if (query.from && !query.to) return

    await router.push({

      pathname: `/${path}/${sub}/${when}`,
      query
    })
  }

  const when = router.query.when || 'day'
  const sub = router.query.sub || 'all'

  const subs = useSubs({ prependSubs: ['all'], sub, appendSubs: [], filterSubs: () => true })

  return (
    <div className='text-muted font-bold my-0 flex items-center flex-wrap'>
      <div className='text-muted font-bold mb-2 flex items-center'>
        stacker analytics in
        <Select
          groupClassName='mb-0 mx-2'
          className={subSelectClasses({ size: 'small' })}
          name='sub'
          items={subs}
          value={sub}
          noForm
          onChange={(formik, e) => {
            const range = when === 'custom' ? { from: router.query.from, to: router.query.to } : {}
            select({ sub: e.target.value, when, ...range })
          }}
        />
        for
        <Select
          groupClassName='mb-0 mx-2'
          className='w-auto'
          name='when'
          items={WHENS}
          value={when}
          noForm
          onChange={(formik, e) => {
            const range = e.target.value === 'custom' ? { from: whenToFrom(when), to: Date.now() } : {}
            select({ sub, when: e.target.value, ...range })
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
            select({ sub, when, from: from.getTime(), to: to.getTime() })
          }}
          from={router.query.from}
          to={router.query.to}
          when={when}
        />}
    </div>
  )
}
