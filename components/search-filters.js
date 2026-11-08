import { useRouter } from 'next/router'
import { Select, DatePicker } from './form'
import { useMe } from './me'
import { whenToFrom } from '@/lib/time'
import { SEARCH_PATH, USER_SEARCH_PATH } from '@/lib/search'

const DEFAULTS = { what: 'all', sort: 'relevance', when: 'forever' }

// next gives a repeated param as an array, which gets '' like a missing one
const param = value => typeof value === 'string' ? value : ''

function FilterSelect ({ onChange, ...props }) {
  return <Select noForm groupClassName='mb-0' onChange={(_, e) => onChange(e.target.value)} {...props} />
}

export default function SearchFilters () {
  const router = useRouter()
  const { me } = useMe()
  const q = param(router.query.q)
  if (!q) return null

  const filters = {
    what: router.pathname === USER_SEARCH_PATH ? 'stackers' : param(router.query.what) || DEFAULTS.what,
    sort: param(router.query.sort) || DEFAULTS.sort,
    when: param(router.query.when) || DEFAULTS.when,
    from: param(router.query.from),
    to: param(router.query.to)
  }

  // from and to work only with a custom range. a new range starts where the
  // current one starts and ends now
  const applyFilters = changes => {
    const { what, sort, when, from, to } = { ...filters, ...changes }
    if (what === 'stackers') {
      router.push({ pathname: USER_SEARCH_PATH, query: { q } })
      return
    }

    const range = when === 'custom' ? { from: from || whenToFrom(filters.when), to: to || Date.now() } : {}
    const query = Object.fromEntries(
      Object.entries({ q, what, sort, when, ...range }).filter(([key, value]) => value && value !== DEFAULTS[key])
    )
    router.push({ pathname: SEARCH_PATH, query })
  }

  return (
    <div className='flex flex-wrap items-center gap-x-2 my-2 text-muted font-bold'>
      <div className='flex items-center gap-2 mb-2'>
        <FilterSelect
          name='what'
          value={filters.what}
          items={['all', 'posts', 'comments', me && 'bookmarks', 'stackers'].filter(Boolean)}
          onChange={what => applyFilters({ what })}
        />
        {filters.what !== 'stackers' && (
          <>
            by
            <FilterSelect
              name='sort'
              value={filters.sort}
              items={['relevance', 'sats', 'new', 'comments']}
              onChange={sort => applyFilters({ sort })}
            />
            for
            <FilterSelect
              name='when'
              value={filters.when}
              items={['custom', 'forever', 'day', 'week', 'month', 'year']}
              onChange={when => applyFilters({ when })}
            />
          </>
        )}
      </div>
      {filters.when === 'custom' && (
        <DatePicker
          noForm
          when='custom'
          from={filters.from}
          to={filters.to}
          className='px-2 py-0'
          onChange={(_, [from, to]) => applyFilters({ from: from.getTime(), to: to.getTime() })}
        />
      )}
    </div>
  )
}
