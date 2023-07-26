import Layout from '../../components/layout'
import { gql, useMutation, useQuery } from '@apollo/client'
import UserHeader from '../../components/user-header'
import Button from 'react-bootstrap/Button'
import styles from '../../styles/user.module.css'
import { useState } from 'react'
import ItemFull from '../../components/item-full'
import { Form, MarkdownInput, SubmitButton } from '../../components/form'
import { useMe } from '../../components/me'
import { USER_FULL } from '../../fragments/users'
import { ITEM_FIELDS } from '../../fragments/items'
import { getGetServerSideProps } from '../../api/ssrApollo'
import FeeButton, { EditFeeButton } from '../../components/fee-button'
import { bioSchema } from '../../lib/validate'
import CancelButton from '../../components/cancel-button'
import { useRouter } from 'next/router'
import PageLoading from '../../components/page-loading'

export const getServerSideProps = getGetServerSideProps(USER_FULL, null,
  data => !data.user)

export function BioForm ({ handleDone, bio }) {
  const [upsertBio] = useMutation(
    gql`
      ${ITEM_FIELDS}
      mutation upsertBio($bio: String!) {
        upsertBio(bio: $bio) {
          id
          bio {
            ...ItemFields
            text
          }
        }
      }`, {
      update (cache, { data: { upsertBio } }) {
        cache.modify({
          id: `User:${upsertBio.id}`,
          fields: {
            bio () {
              return upsertBio.bio
            }
          }
        })
      }
    }
  )

  return (
    <div className={styles.createFormContainer}>
      <Form
        initial={{
          bio: bio?.text || ''
        }}
        schema={bioSchema}
        onSubmit={async values => {
          const { error } = await upsertBio({ variables: values })
          if (error) {
            throw new Error({ message: error.toString() })
          }
          handleDone?.()
        }}
      >
        <MarkdownInput
          topLevel
          name='bio'
          minRows={6}
        />
        <div className='d-flex mt-3 justify-content-end'>
          <CancelButton onClick={handleDone} />
          {bio?.text
            ? <EditFeeButton
                paidSats={bio?.meSats}
                parentId={null} text='save' ChildButton={SubmitButton} variant='secondary'
              />
            : <FeeButton
                baseFee={1} parentId={null} text='create'
                ChildButton={SubmitButton} variant='secondary'
              />}
        </div>
      </Form>
    </div>
  )
}

export function UserLayout ({ user, children }) {
  return (
    <Layout user={user} containClassName={styles.contain}>
      <UserHeader user={user} />
      {children}
    </Layout>
  )
}

export default function User ({ ssrData }) {
  const [create, setCreate] = useState(false)
  const [edit, setEdit] = useState(false)
  const router = useRouter()
  const me = useMe()

  const { data } = useQuery(USER_FULL, { variables: { ...router.query } })
  if (!data && !ssrData) return <PageLoading />

  const { user } = data || ssrData
  const mine = me?.name === user.name

  return (
    <UserLayout user={user}>
      {user.bio
        ? (edit
            ? (
              <div className={styles.create}>
                <BioForm bio={user.bio} handleDone={() => setEdit(false)} />
              </div>)
            : <ItemFull item={user.bio} bio handleClick={setEdit} />
          )
        : (mine &&
          <div className={styles.create}>
            {create
              ? <BioForm handleDone={() => setCreate(false)} />
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
