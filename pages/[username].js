import Layout from '../components/layout'
import { gql, useMutation, useQuery } from '@apollo/client'
import ApolloClient from '../api/client'
import UserHeader from '../components/user-header'
import Seo from '../components/seo'
import { Button } from 'react-bootstrap'
import styles from '../styles/user.module.css'
import { useState } from 'react'
import ItemFull from '../components/item-full'
import * as Yup from 'yup'
import { Form, MarkdownInput, SubmitButton } from '../components/form'
import ActionTooltip from '../components/action-tooltip'
import TextareaAutosize from 'react-textarea-autosize'
import { useMe } from '../components/me'
import { USER_FIELDS } from '../fragments/users'
import { useRouter } from 'next/router'
import { ITEM_FIELDS } from '../fragments/items'

export async function getServerSideProps ({ req, params }) {
  const { error, data: { user } } = await (await ApolloClient(req)).query({
    query:
      gql`
      ${USER_FIELDS}
      {
        user(name: "${params.username}") {
          ...UserFields
        }
      }`
  })

  if (!user || error) {
    return {
      notFound: true
    }
  }

  return {
    props: {
      user
    }
  }
}

const BioSchema = Yup.object({
  bio: Yup.string().required('required').trim()
})

export function BioForm ({ handleSuccess, bio }) {
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
        schema={BioSchema}
        onSubmit={async values => {
          const { error } = await upsertBio({ variables: values })
          if (error) {
            throw new Error({ message: error.toString() })
          }
          handleSuccess && handleSuccess()
        }}
      >
        <MarkdownInput
          name='bio'
          as={TextareaAutosize}
          minRows={4}
        />
        <ActionTooltip>
          <SubmitButton variant='secondary' className='mt-3'>{bio?.text ? 'save' : 'create'}</SubmitButton>
        </ActionTooltip>
      </Form>
    </div>
  )
}

export default function User ({ user }) {
  const [create, setCreate] = useState(false)
  const [edit, setEdit] = useState(false)
  const me = useMe()

  const query = gql`
    ${USER_FIELDS}
    {
      user(name: "${user.name}") {
        ...UserFields
      }
    }`

  const router = useRouter()
  const { error, data } = useQuery(query, {
    fetchPolicy: router.query.cache ? 'cache-first' : undefined
  })
  if (error) {
    return <div>Failed to load!</div>
  }

  // XXX replace item with cache version
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
                <BioForm bio={user.bio} handleSuccess={() => setEdit(false)} />
              </div>)
            : <ItemFull item={user.bio} bio handleClick={setEdit} />
          )
        : (mine &&
          <div className={styles.create}>
            {create
              ? <BioForm handleSuccess={() => setCreate(false)} />
              : (
                  mine &&
                    <Button
                      onClick={setCreate}
                      size='md' variant='secondary'
                    >create bio
                    </Button>
                )}
          </div>)}
    </Layout>
  )
}
