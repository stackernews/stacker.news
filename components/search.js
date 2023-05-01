import { Button, Container } from 'react-bootstrap'
import styles from './search.module.css'
import SearchIcon from '../svgs/search-line.svg'
import CloseIcon from '../svgs/close-line.svg'
import { useEffect, useState } from 'react'
import { Form, Input, Select, SubmitButton } from './form'
import { useRouter } from 'next/router'

export default function Search ({ sub }) {
  const router = useRouter()
  const [searching, setSearching] = useState(router.query.q)
  const [q, setQ] = useState(router.query.q || '')
  const [atBottom, setAtBottom] = useState()

  useEffect(() => {
    setAtBottom(Math.ceil(window.innerHeight + window.pageYOffset) >= document.body.offsetHeight)
    window.onscroll = function (ev) {
      if (Math.ceil(window.innerHeight + window.pageYOffset) >= document.body.offsetHeight) {
        setAtBottom(true)
      } else {
        setAtBottom(false)
      }
    }
  }, [])

  const search = async values => {
    let prefix = ''
    if (sub) {
      prefix = `/~${sub}`
    }

    if (values.q?.trim() !== '') {
      if (values.what === 'users') {
        await router.push({
          pathname: '/users/search',
          query: { q, what: 'users' }
        })
        return
      }

      if (values.what === '') delete values.what
      if (values.sort === '') delete values.sort
      if (values.when === '') delete values.when
      await router.push({
        pathname: prefix + '/search',
        query: values
      })
    }
  }

  const showSearch = atBottom || searching || router.query.q
  const filter = sub !== 'jobs'
  return (
    <>
      <div className={`${styles.searchSection} ${showSearch ? styles.solid : styles.hidden}`}>
        <Container className={`px-sm-0 ${styles.searchContainer} ${filter ? styles.leaveRoom : ''}`}>
          {showSearch
            ? (
              <Form
                className={styles.formActive}
                initial={{
                  q: router.query.q || '',
                  what: router.query.what || '',
                  sort: router.query.sort || '',
                  when: router.query.when || ''
                }}
                onSubmit={search}
              >
                {filter &&
                  <div className='text-muted font-weight-bold my-3 d-flex align-items-center'>
                    <Select
                      groupClassName='mr-2 mb-0'
                      onChange={(formik, e) => search({ ...formik?.values, what: e.target.value })}
                      name='what'
                      size='sm'
                      items={['all', 'posts', 'comments', 'users']}
                    />
                    {router.query.what !== 'users' &&
                      <>
                        by
                        <Select
                          groupClassName='mx-2 mb-0'
                          onChange={(formik, e) => search({ ...formik?.values, sort: e.target.value })}
                          name='sort'
                          size='sm'
                          items={['match', 'recent', 'comments', 'sats', 'votes']}
                        />
                        for
                        <Select
                          groupClassName='mb-0 ml-2'
                          onChange={(formik, e) => search({ ...formik?.values, when: e.target.value })}
                          name='when'
                          size='sm'
                          items={['forever', 'day', 'week', 'month', 'year']}
                        />

                      </>}
                  </div>}
                <div className={`${styles.active}`}>
                  <Input
                    name='q'
                    required
                    autoFocus
                    groupClassName='mr-3 mb-0 flex-grow-1'
                    className='flex-grow-1'
                    clear
                    onChange={async (formik, e) => {
                      setSearching(true)
                      setQ(e.target.value?.trim())
                    }}
                  />
                  {q || atBottom || router.query.q
                    ? (
                      <SubmitButton variant='primary' className={styles.search}>
                        <SearchIcon width={22} height={22} />
                      </SubmitButton>
                      )
                    : (
                      <Button
                        className={styles.search} onClick={() => {
                          setSearching(false)
                        }}
                      >
                        <CloseIcon width={26} height={26} />
                      </Button>)}
                </div>

              </Form>
              )
            : (
              <Button className={`${styles.search} ${styles.formActive}`} onClick={() => setSearching(true)}>
                <SearchIcon width={22} height={22} />
              </Button>
              )}
        </Container>
      </div>
      <div className={`${styles.searchPadding} ${filter ? styles.leaveRoom : ''}`} />
    </>
  )
}
