import { Button, Container } from 'react-bootstrap'
import styles from './search.module.css'
import SearchIcon from '../svgs/search-fill.svg'
import CloseIcon from '../svgs/close-line.svg'
import { useState } from 'react'
import { Form, Input, SubmitButton } from './form'

export default function Search () {
  const [searching, setSearching] = useState()
  const [q, setQ] = useState()
  return (
    <>
      <div className={`${styles.searchSection} ${searching ? styles.solid : styles.hidden}`}>
        <Container className={`px-sm-0 ${styles.searchContainer}`}>
          {searching
            ? (
              <Form
                initial={{
                  q: ''
                }}
                inline
                className={`w-auto ${styles.active}`}
              >
                <Input
                  name='q'
                  required
                  autoFocus
                  groupClassName='mr-3 mb-0 flex-grow-1'
                  className='w-100'
                  onChange={async (formik, e) => {
                    setQ(e.target.value?.trim())
                  }}
                />
                {q
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
