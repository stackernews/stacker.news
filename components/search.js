import Container from 'react-bootstrap/Container'
import styles from './search.module.css'
import SearchIcon from '@/svgs/search-line.svg'
import { useMemo, useRef, useCallback } from 'react'
import {
  Form,
  Input,
  Select,
  DatePicker,
  SubmitButton,
  useDualAutocomplete,
  DualAutocompleteWrapper
} from './form'
import { useRouter } from 'next/router'
import { whenToFrom } from '@/lib/time'
import { useMe } from './me'
import { useField } from 'formik'
import { searchSchema } from '@/lib/validate'

export default function Search ({ sub }) {
  const router = useRouter()
  const { me } = useMe()
  const q = typeof router.query.q === 'string' ? router.query.q : ''
  const from = typeof router.query.from === 'string' ? router.query.from : ''
  const to = typeof router.query.to === 'string' ? router.query.to : ''
  const queryWhat = typeof router.query.what === 'string' ? router.query.what : ''
  const querySort = typeof router.query.sort === 'string' ? router.query.sort : ''
  const queryWhen = typeof router.query.when === 'string' ? router.query.when : ''

  const search = async values => {
    let prefix = ''
    if (sub) {
      prefix = `/~${sub}`
    }

    const query = values.q?.trim()
    if (query) {
      const nextValues = { ...values, q: query }

      if (nextValues.what === 'stackers') {
        await router.push({
          pathname: '/stackers/search',
          query: { q: query, what: 'stackers' }
        }, {
          pathname: '/stackers/search',
          query: { q: query }
        })
        return
      }

      if (nextValues.what === '' || nextValues.what === 'all') delete nextValues.what
      if (nextValues.sort === '' || nextValues.sort === 'relevance') delete nextValues.sort
      if (nextValues.when === '' || nextValues.when === 'forever') delete nextValues.when
      if (nextValues.when !== 'custom') { delete nextValues.from; delete nextValues.to }
      if (nextValues.from && !nextValues.to) return

      await router.push({
        pathname: prefix + '/search',
        query: nextValues
      })
    }
  }

  const filter = sub !== 'jobs'
  const what = router.pathname.startsWith('/stackers') ? 'stackers' : queryWhat || 'all'
  const sort = querySort || 'relevance'
  const when = queryWhen || 'forever'
  const whatItemOptions = useMemo(() => (['all', 'posts', 'comments', me ? 'bookmarks' : undefined, 'stackers'].filter(item => !!item)), [me])

  return (
    <>
      <div className={styles.searchSection}>
        <Container className={`px-0 ${styles.searchContainer}`}>
          <Form
            initial={{ q, what, sort, when, from, to }}
            onSubmit={values => search({ ...values })}
            schema={searchSchema}
            enableReinitialize
          >
            <div className={`${styles.active} mb-3`}>
              <SearchInput
                name='q'
                required
                autoFocus
                groupClassName='me-3 mb-0 flex-grow-1'
                className='flex-grow-1'
              />
              <SubmitButton variant='primary' className={styles.search}>
                <SearchIcon width={22} height={22} />
              </SubmitButton>
            </div>
            {filter && router.query.q &&
              <div className='text-muted fw-bold d-flex align-items-center flex-wrap'>
                <div className='text-muted fw-bold d-flex align-items-center mb-2'>
                  <Select
                    groupClassName='me-2 mb-0'
                    onChange={(formik, e) => search({ ...formik?.values, what: e.target.value })}
                    name='what'
                    size='sm'
                    overrideValue={what}
                    items={whatItemOptions}
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
                        items={['relevance', 'sats', 'new', 'comments']}
                      />
                      for
                      <Select
                        groupClassName='mb-0 mx-2'
                        onChange={(formik, e) => {
                          const range = e.target.value === 'custom' ? { from: whenToFrom(when), to: Date.now() } : {}
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
                    className='p-0 px-2'
                    onChange={(formik, [from, to], e) => {
                      search({ ...formik?.values, from: from.getTime(), to: to.getTime() })
                    }}
                    from={from}
                    to={to}
                    when={when}
                  />}
              </div>}
          </Form>
        </Container>
      </div>
    </>
  )
}

function SearchInput ({ name, ...props }) {
  const [, meta, helpers] = useField(name)
  const inputRef = useRef(null)

  const setCaret = useCallback(({ start, end }) => {
    inputRef.current?.setSelectionRange(start, end)
  }, [])

  const { userAutocomplete, territoryAutocomplete, handleTextChange, handleKeyDown, handleBlur } = useDualAutocomplete({
    meta,
    helpers,
    innerRef: inputRef,
    setSelectionRange: setCaret
  })

  const handleInputChange = useCallback((_formik, e) => {
    handleTextChange(e)
  }, [handleTextChange])

  return (
    <div className='position-relative flex-grow-1'>
      <DualAutocompleteWrapper
        userAutocomplete={userAutocomplete}
        territoryAutocomplete={territoryAutocomplete}
      >
        {({ userSuggestOnKeyDown, territorySuggestOnKeyDown, resetUserSuggestions, resetTerritorySuggestions }) => (
          <Input
            name={name}
            innerRef={inputRef}
            clear
            autoComplete='off'
            onChange={handleInputChange}
            onKeyDown={(e) => {
              handleKeyDown(e, userSuggestOnKeyDown, territorySuggestOnKeyDown)
            }}
            onBlur={() => handleBlur(resetUserSuggestions, resetTerritorySuggestions)}
            {...props}
          />
        )}
      </DualAutocompleteWrapper>
    </div>
  )
}
