import Container from 'react-bootstrap/Container'
import styles from './search.module.css'
import SearchIcon from '@/svgs/search-line.svg'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  Form,
  Input,
  Select,
  DatePicker,
  SubmitButton,
  useEntityAutocomplete,
  UserSuggest,
  TerritorySuggest
} from './form'
import { useRouter } from 'next/router'
import { whenToFrom } from '@/lib/time'
import { useMe } from './me'
import { useField } from 'formik'

export default function Search ({ sub }) {
  const router = useRouter()
  const [q, setQ] = useState(router.query.q || '')
  const { me } = useMe()

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
      if (values.sort === '' || values.sort === 'relevance') delete values.sort
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
  const sort = router.query.sort || 'relevance'
  const when = router.query.when || 'forever'
  const whatItemOptions = useMemo(() => (['all', 'posts', 'comments', me ? 'bookmarks' : undefined, 'stackers'].filter(item => !!item)), [me])

  return (
    <>
      <div className={styles.searchSection}>
        <Container className={`px-0 ${styles.searchContainer}`}>
          <Form
            initial={{ q, what, sort, when, from: '', to: '' }}
            onSubmit={values => search({ ...values })}
          >
            <div className={`${styles.active} mb-3`}>
              <SearchInput
                name='q'
                required
                autoFocus
                groupClassName='me-3 mb-0 flex-grow-1'
                className='flex-grow-1'
                setOuterQ={setQ}
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
                        items={['relevance', 'zaprank', 'recent', 'comments', 'sats']}
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

function SearchInput ({ name, setOuterQ, ...props }) {
  const [, meta, helpers] = useField(name)
  const inputRef = useRef(null)

  useEffect(() => {
    if (meta.value !== undefined) setOuterQ(meta.value.trim())
  }, [meta.value, setOuterQ])

  const setCaret = useCallback(({ start, end }) => {
    inputRef.current?.setSelectionRange(start, end)
  }, [])

  const userAutocomplete = useEntityAutocomplete({
    prefix: '@',
    meta,
    helpers,
    innerRef: inputRef,
    setSelectionRange: setCaret,
    SuggestComponent: UserSuggest
  })

  const territoryAutocomplete = useEntityAutocomplete({
    prefix: '~',
    meta,
    helpers,
    innerRef: inputRef,
    setSelectionRange: setCaret,
    SuggestComponent: TerritorySuggest
  })

  const handleChange = useCallback((formik, e) => {
    setOuterQ(e.target.value.trim())
    if (!userAutocomplete.handleTextChange(e)) {
      territoryAutocomplete.handleTextChange(e)
    }
  }, [setOuterQ, userAutocomplete, territoryAutocomplete])

  const onKeyDown = useCallback((userSuggestOnKeyDown, territorySuggestOnKeyDown) => (e) => {
    const metaOrCtrl = e.metaKey || e.ctrlKey
    if (metaOrCtrl) return
    if (userAutocomplete.entityData) return userSuggestOnKeyDown(e)
    if (territoryAutocomplete.entityData) return territorySuggestOnKeyDown(e)
  }, [userAutocomplete.entityData, territoryAutocomplete.entityData])

  return (
    <div className='position-relative flex-grow-1'>
      <UserSuggest
        query={userAutocomplete.entityData?.query}
        onSelect={userAutocomplete.handleSelect}
        dropdownStyle={userAutocomplete.entityData?.style}
      >{({ onKeyDown: userSuggestOnKeyDown, resetSuggestions: resetUserSuggestions }) => (
        <TerritorySuggest
          query={territoryAutocomplete.entityData?.query}
          onSelect={territoryAutocomplete.handleSelect}
          dropdownStyle={territoryAutocomplete.entityData?.style}
        >{({ onKeyDown: territorySuggestOnKeyDown, resetSuggestions: resetTerritorySuggestions }) => (
          <Input
            name={name}
            innerRef={inputRef}
            clear
            autoComplete='off'
            onChange={handleChange}
            onKeyDown={onKeyDown(userSuggestOnKeyDown, territorySuggestOnKeyDown)}
            onBlur={() => {
              setTimeout(resetUserSuggestions, 500)
              setTimeout(resetTerritorySuggestions, 500)
            }}
            {...props}
          />
        )}
        </TerritorySuggest>
      )}
      </UserSuggest>
    </div>
  )
}
