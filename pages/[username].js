import Layout from '../components/layout'
import { gql, useMutation } from '@apollo/client'
import ApolloClient from '../api/client'
import UserHeader from '../components/user-header'
import Seo from '../components/seo'
import { Button } from 'react-bootstrap'
import styles from '../styles/user.module.css'
import { useState } from 'react'
import { useSession } from 'next-auth/client'
import { ITEM_FIELDS } from '../fragments/items'
import ItemFull from '../components/item-full'
import * as Yup from 'yup'
import { Form, MarkdownInput, SubmitButton } from '../components/form'
import ActionTooltip from '../components/action-tooltip'
import TextareaAutosize from 'react-textarea-autosize'

export async function getServerSideProps ({ req, params }) {
  const { error, data: { user } } = await (await ApolloClient(req)).query({
    query:
      gql`
      ${ITEM_FIELDS}
      {
        user(name: "${params.username}") {
          id
          createdAt
          name
          nitems
          ncomments
          stacked
          sats
          bio {
            ...ItemFields
          }
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

function BioForm () {
  const [createBio] = useMutation(
    gql`
      mutation createBio($bio: String!) {
        createBio(bio: $bio) {
          id
        }
      }`, {
      update (cache, { data: { createBio } }) {
        cache.modify({
          id: `User:${createBio.userId}`,
          fields: {
            bio () {
              return createBio
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
          bio: ''
        }}
        schema={BioSchema}
        onSubmit={async values => {
          const { error } = await createBio({ variables: values })
          if (error) {
            throw new Error({ message: error.toString() })
          }
        }}
      >
        <MarkdownInput
          name='bio'
          as={TextareaAutosize}
          minRows={4}
        />
        <ActionTooltip>
          <SubmitButton variant='secondary' className='mt-3'>create</SubmitButton>
        </ActionTooltip>
      </Form>
    </div>
  )
}

export default function User ({ user }) {
  const [create, setCreate] = useState(false)
  const [session] = useSession()

  // need to check if this is the user's page before exposing create/edit

  return (
    <Layout noSeo containClassName={styles.contain}>
      <Seo user={user} />
      <UserHeader user={user} />
      {user.bio
        ? <ItemFull item={user.bio} bio />
        : (
          <div className={styles.create}>
            {create
              ? <BioForm />
              : (
                  session?.user?.name === user.name &&
                    <Button onClick={setCreate} size='md' variant='secondary'>create bio</Button>
                )}
          </div>)}
    </Layout>
  )
}
