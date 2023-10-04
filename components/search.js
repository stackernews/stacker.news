import Container from 'react-bootstrap/Container'
import styles from './search.module.css'
import SearchIcon from '../svgs/search-line.svg'
import { useEffect, useRef, useState } from 'react'
import { Form, Input, Select, DatePicker, SubmitButton } from './form'
import { useRouter } from 'next/router'

export default function Search ({ sub }) {
  const router = useRouter()
  const [q, setQ] = useState(router.query.q || '')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const search = async values => {
    let prefix = ''
    if (sub) {
      prefix = `/~${sub}`
    }

    if (values.q?.trim() !== '') {
      if (values.what === 'stackers') {
        await router.push({
          pathname: '/stackers/search',
          query: { q, what: 'stackers' }
        }, {
          pathname: '/stackers/search',
          query: { q }
        })
        return
      }

      if (values.what === '' || values.what === 'all') delete values.what
      if (values.sort === '' || values.sort === 'zaprank') delete values.sort
      if (values.when === '' || values.when === 'forever') delete values.when
      if (values.when !== 'custom') { delete values.from; delete values.to }
      await router.push({
        pathname: prefix + '/search',
        query: values
      })
    }
  }

  const filter = sub !== 'jobs'
  const what = router.pathname.startsWith('/stackers') ? 'stackers' : router.query.what || 'all'
  const sort = router.query.sort || 'zaprank'
  const when = router.query.when || 'forever'
  const from = router.query.from || new Date().toISOString()
  const to = router.query.to || new Date().toISOString()

  const [datePicker, setDatePicker] = useState(when === 'custom')
  // The following state is needed for the date picker (and driven by the date picker).
  // Substituting router.query or formik values would cause network lag and/or timezone issues.
  const [range, setRange] = useState({ start: new Date(from), end: new Date(to) })

  return (
    <>
      <div className={styles.searchSection}>
        <Container className={`px-md-0 ${styles.searchContainer}`}>
          <Form
            initial={{ q, what, sort, when, from, to }}
            onSubmit={search}
          >
            <div className={`${styles.active} my-3`}>
              <Input
                name='q'
                required
                autoFocus
                groupClassName='me-3 mb-0 flex-grow-1'
                className='flex-grow-1'
                clear
                innerRef={inputRef}
                overrideValue={q}
                onChange={async (formik, e) => {
                  setQ(e.target.value?.trim())
                }}
              />
              <SubmitButton variant='primary' className={styles.search}>
                <SearchIcon width={22} height={22} />
              </SubmitButton>
            </div>
            {filter &&
              <div className='text-muted fw-bold d-flex align-items-center flex-wrap pb-2'>
                <div className='text-muted fw-bold d-flex align-items-center pb-2'>
                  <Select
                    groupClassName='me-2 mb-0'
                    onChange={(formik, e) => search({ ...formik?.values, what: e.target.value })}
                    name='what'
                    size='sm'
                    overrideValue={what}
                    items={['all', 'posts', 'comments', 'stackers']}
                  />
                  {what !== 'stackers' &&
                    <>
                      by
                      <Select
                        groupClassName='mx-2 mb-0'
                        onChange={(formik, e) => search({ ...formik?.values, sort: e.target.value })}
                        name='sort'
                        size='sm'
                        overrideValue={sort}
                        items={['zaprank', 'match', 'recent', 'comments', 'sats']}
                      />
                      for
                      <Select
                        groupClassName='mb-0 mx-2'
                        onChange={(formik, e) => {
                          search({ ...formik?.values, when: e.target.value, from: from || new Date().toISOString(), to: to || new Date().toISOString() })
                          setDatePicker(e.target.value === 'custom')
                          if (e.target.value === 'custom') setRange({ start: new Date(), end: new Date() })
                        }}
                        name='when'
                        size='sm'
                        overrideValue={when}
                        items={['custom', 'forever', 'day', 'week', 'month', 'year']}
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
                      search({ ...formik?.values, from: start && start.toISOString(), to: end && end.toISOString() })
                    }}
                    selected={range.start}
                    startDate={range.start} endDate={range.end}
                    selectsRange
                    dateFormat='MM/dd/yy'
                    maxDate={new Date()}
                    minDate={new Date('2021-05-01')}
                  />}
              </div>}
          </Form>
        </Container>
      </div>
    </>
  )
}
