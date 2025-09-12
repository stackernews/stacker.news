import Layout from '@/components/layout'
import { useQuery } from '@apollo/client'
import UserHeader from '@/components/user-header'
import Button from 'react-bootstrap/Button'
import styles from '@/styles/user.module.css'
import { useState } from 'react'
import ItemFull from '@/components/item-full'
import { Form, MarkdownInput } from '@/components/form'
import { useMe } from '@/components/me'
import { USER_FULL } from '@/fragments/users'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { FeeButtonProvider } from '@/components/fee-button'
import { bioSchema } from '@/lib/validate'
import { useRouter } from 'next/router'
import PageLoading from '@/components/page-loading'
import { ItemButtonBar } from '@/components/post'
import useItemSubmit from '@/components/use-item-submit'
import { UPSERT_BIO } from '@/fragments/payIn'

export const getServerSideProps = getGetServerSideProps({
  query: USER_FULL,
  notFound: data => !data.user
})

export function BioForm ({ handleDone, bio, me }) {
  const onSubmit = useItemSubmit(UPSERT_BIO, {
    navigateOnSubmit: false,
    payInMutationOptions: {
      update (cache, { data: { upsertBio: { result, invoice } } }) {
        if (!result) return

        cache.modify({
          id: `User:${me.id}`,
          fields: {
            bio () {
              return result.text
            }
          }
        })
      }
    },
    onSuccessfulSubmit: (data, { resetForm }) => {
      handleDone?.()
    }
  })

  return (
    <div className={styles.createFormContainer}>
      <FeeButtonProvider>
        <Form
          initial={{
            text: bio?.text || ''
          }}
          schema={bioSchema}
          onSubmit={onSubmit}
          storageKeyPrefix={`bio-${me.id}`}
        >
          <MarkdownInput
            topLevel
            name='text'
            minRows={6}
          />
          <ItemButtonBar createText='save' onCancel={handleDone} />
        </Form>
      </FeeButtonProvider>
    </div>
  )
}

export function UserLayout ({ user, children, containClassName }) {
  return (
    <Layout user={user} footer footerLinks={false} containClassName={containClassName}>
      <UserHeader user={user} />
      {children}
    </Layout>
  )
}

export default function User ({ ssrData }) {
  const [create, setCreate] = useState(false)
  const [edit, setEdit] = useState(false)
  const router = useRouter()
  const { me } = useMe()

  const { data } = useQuery(USER_FULL, { variables: { ...router.query } })
  if (!data && !ssrData) return <PageLoading />

  const { user } = data || ssrData
  const mine = me?.name === user.name

  return (
    <UserLayout user={user} containClassName={!user.bio && mine && styles.contain}>
      {user.bio
        ? (edit
            ? (
              <div className={styles.create}>
                <BioForm bio={user.bio} me={me} handleDone={() => setEdit(false)} />
              </div>)
            : <ItemFull item={user.bio} bio handleClick={setEdit} />
          )
        : (mine &&
          <div className={styles.create}>
            {create
              ? <BioForm me={me} handleDone={() => setCreate(false)} />
              : (
                  mine &&
                    <div className='text-center'>
                      <Button
                        onClick={setCreate}
                        size='md' variant='secondary'
                      >create bio
                      </Button>
                      <small className='d-block mt-3 text-muted'>your bio is also a post introducing yourself to other stackers</small>
                    </div>
                )}
          </div>)}
    </UserLayout>
  )
}
