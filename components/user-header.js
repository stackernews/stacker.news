import { Button } from 'react-bootstrap'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Nav from 'react-bootstrap/Nav'
import { useState } from 'react'
import { Form, Input, SubmitButton } from './form'
import InputGroup from 'react-bootstrap/InputGroup'
import * as Yup from 'yup'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import styles from './user-header.module.css'
import { useMe } from './me'

const NAME_QUERY =
gql`
  query nameAvailable($name: String!) {
    nameAvailable(name: $name)
  }
`

const NAME_MUTATION =
gql`
  mutation setName($name: String!) {
    setName(name: $name)
  }
`

export default function UserHeader ({ user }) {
  const [editting, setEditting] = useState(false)
  const me = useMe()
  const router = useRouter()
  const client = useApolloClient()
  const [setName] = useMutation(NAME_MUTATION)

  const Satistics = () => <h1 className='mb-0'><small className='text-success'>{user.sats} sats \ {user.stacked} stacked</small></h1>
  const isMe = me?.name === user.name

  const UserSchema = Yup.object({
    name: Yup.string()
      .required('required')
      .matches(/^[\w_]+$/, 'only letters, numbers, and _')
      .max(32, 'too long')
      .test({
        name: 'name',
        test: async name => {
          if (!name || !name.length) return false
          const { data } = await client.query({ query: NAME_QUERY, variables: { name }, fetchPolicy: 'network-only' })
          return data.nameAvailable
        },
        message: 'taken'
      })
  })

  return (
    <>
      <div>
        {editting
          ? (
            <Form
              schema={UserSchema}
              initial={{
                name: user.name
              }}
              validateImmediately
              onSubmit={async ({ name }) => {
                if (name === user.name) {
                  setEditting(false)
                  return
                }
                const { error } = await setName({ variables: { name } })
                if (error) {
                  throw new Error({ message: error.toString() })
                }
                router.replace({
                  pathname: router.pathname,
                  query: { ...router.query, name }
                })

                client.writeFragment({
                  id: `User:${user.id}`,
                  fragment: gql`
                  fragment CurUser on User {
                    name
                  }
                `,
                  data: {
                    name
                  }
                })

                setEditting(false)
              }}
            >
              <div className='d-flex align-items-center'>
                <Input
                  prepend=<InputGroup.Text>@</InputGroup.Text>
                  name='name'
                  autoFocus
                  groupClassName={`mb-0 ${styles.username}`}
                  showValid
                />
                <SubmitButton variant='link' onClick={() => setEditting(true)}>save</SubmitButton>
              </div>
            </Form>
            )
          : (
            <div className='d-flex align-items-center'>
              <h2 className='mb-0'>@{user.name}</h2>
              {isMe &&
                <Button variant='link' onClick={() => setEditting(true)}>edit nym</Button>}
            </div>
            )}
        <Satistics user={user} />
      </div>
      <Nav
        className={styles.nav}
        activeKey={router.asPath.split('?')[0]}
      >
        <Nav.Item>
          <Link href={'/' + user.name} passHref>
            <Nav.Link>bio</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href={'/' + user.name + '/posts'} passHref>
            <Nav.Link>{user.nitems} posts</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href={'/' + user.name + '/comments'} passHref>
            <Nav.Link>{user.ncomments} comments</Nav.Link>
          </Link>
        </Nav.Item>
        {isMe &&
          <Nav.Item>
            <Link href='/satistics?inc=invoice,withdrawal' passHref>
              <Nav.Link eventKey='/satistics'>satistics</Nav.Link>
            </Link>
          </Nav.Item>}
      </Nav>
    </>
  )
}
