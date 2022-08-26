import { Button, Container } from 'react-bootstrap'
import styles from './search.module.css'
import SearchIcon from '../svgs/search-fill.svg'
import CloseIcon from '../svgs/close-line.svg'
import { useEffect, useState } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useRouter } from 'next/router'

export default function Search ({ sub }) {
  const router = useRouter()
  const [searching, setSearching] = useState(router.query.q)
  const [q, setQ] = useState(router.query.q)
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

  const showSearch = atBottom || searching || router.query.q
  return (
    <>
      <div className={`${styles.searchSection} ${showSearch ? styles.solid : styles.hidden}`}>
        <Container className={`px-sm-0 ${styles.searchContainer}`}>
          {showSearch
            ? (
              <Form
                initial={{
                  q: router.query.q || ''
                }}
                className={`w-auto ${styles.active}`}
                onSubmit={async ({ q }) => {
                  if (q.trim() !== '') {
                    let prefix = ''
                    if (sub) {
                      prefix = `/~${sub}`
                    }
                    router.push(prefix + `/search?q=${encodeURIComponent(q)}`)
                  }
                }}
              >
                <Input
                  name='q'
                  required
                  autoFocus={showSearch && !atBottom}
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

              </Form>
              )
            : (
              <Button className={`${styles.search} ${styles.active}`} onClick={() => setSearching(true)}>
                <SearchIcon width={22} height={22} />
              </Button>
              )}
        </Container>
      </div>
      <div className={styles.searchPadding} />
    </>
  )
}
