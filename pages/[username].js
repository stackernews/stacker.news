import Layout from '../components/layout'
import { gql, useMutation } from '@apollo/client'
import ApolloClient from '../api/client'
import UserHeader from '../components/user-header'
import Seo from '../components/seo'
import { Button } from 'react-bootstrap'
import styles from '../styles/user.module.css'
import { useState } from 'react'
import { DiscussionForm } from '../components/discussion-form'
import { useSession } from 'next-auth/client'
import { ITEM_FIELDS } from '../fragments/items'
import ItemFull from '../components/item-full'

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

function BioForm () {
  const [createBio] = useMutation(
    gql`
      mutation createBio($title: String!, $text: String) {
        createBio(title: $title, text: $text) {
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
      <DiscussionForm
        titleLabel='one line bio' textLabel='full bio' buttonText='create'
        handleSubmit={async values => {
          const { error } = await createBio({ variables: values })
          if (error) {
            throw new Error({ message: error.toString() })
          }
        }}
      />
    </div>
  )
}

export default function User ({ user }) {
  const [create, setCreate] = useState(false)
  const [session] = useSession()

  return (
    <Layout noSeo containClassName={styles.contain}>
      <Seo user={user} />
      <UserHeader user={user} />
      {user.bio
        ? <ItemFull item={user.bio} minimal />
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
