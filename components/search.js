import Container from 'react-bootstrap/Container'
import styles from './search.module.css'
import SearchIcon from '../svgs/search-line.svg'
import { useEffect, useRef, useState } from 'react'
import { Form, Input, Select, DatePicker, SubmitButton } from './form'
import { useRouter } from 'next/router'
import { dayMonthYear, whenToFrom } from '../lib/time'

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
      if (values.from && !values.to) return

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

  return (
    <>
      <div className={styles.searchSection}>
        <Container className={`px-md-0 ${styles.searchContainer}`}>
          <Form
            initial={{ q, what, sort, when, from: '', to: '' }}
            onSubmit={values => search({ ...values })}
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
            {filter && router.query.q &&
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
                          const range = e.target.value === 'custom' ? { from: whenToFrom(when), to: dayMonthYear(new Date()) } : {}
                          search({ ...formik?.values, when: e.target.value, ...range })
                        }}
                        name='when'
                        size='sm'
                        overrideValue={when}
                        items={['custom', 'forever', 'day', 'week', 'month', 'year']}
                      />
                    </>}
                </div>
                {when === 'custom' &&
                  <DatePicker
                    fromName='from'
                    toName='to'
                    className='p-0 px-2 mb-2'
                    onChange={(formik, [from, to], e) => {
                      search({ ...formik?.values, from, to })
                    }}
                    from={router.query.from}
                    to={router.query.to}
                    when={when}
                  />}
              </div>}
          </Form>
        </Container>
      </div>
    </>
  )
}
