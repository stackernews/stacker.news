import Layout from '../../components/layout'
import { gql, useMutation, useQuery } from '@apollo/client'
import UserHeader from '../../components/user-header'
import Seo from '../../components/seo'
import { Button } from 'react-bootstrap'
import styles from '../../styles/user.module.css'
import { useState } from 'react'
import ItemFull from '../../components/item-full'
import { Form, MarkdownInput, SubmitButton } from '../../components/form'
import TextareaAutosize from 'react-textarea-autosize'
import { useMe } from '../../components/me'
import { USER_FULL } from '../../fragments/users'
import { ITEM_FIELDS } from '../../fragments/items'
import { getGetServerSideProps } from '../../api/ssrApollo'
import FeeButton, { EditFeeButton } from '../../components/fee-button'
import { bioSchema } from '../../lib/validate'

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
          as={TextareaAutosize}
          minRows={6}
        />
        <div className='d-flex mt-3'>
          <Button
            className='mr-2' variant='grey-medium' type='button' onClick={handleDone}
          >cancel
          </Button>
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

export default function User ({ data: { user } }) {
  const [create, setCreate] = useState(false)
  const [edit, setEdit] = useState(false)
  const me = useMe()

  const { data } = useQuery(USER_FULL, { variables: { name: user.name } })

  if (data) {
    ({ user } = data)
  }

  const mine = me?.name === user.name

  return (
    <Layout noSeo containClassName={styles.contain}>
      <Seo user={user} />
      <UserHeader user={user} />
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
                      <small className='d-block mt-3 text-muted'>your bio is also a post introducing yourself to other users</small>
                    </div>
                )}
          </div>)}
    </Layout>
  )
}
