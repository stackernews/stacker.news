import { Button } from 'react-bootstrap'
import { useSession } from 'next-auth/client'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Nav from 'react-bootstrap/Nav'
import { useState } from 'react'
import { Form, Input, SubmitButton } from './form'
import InputGroup from 'react-bootstrap/InputGroup'
import * as Yup from 'yup'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import styles from './user-header.module.css'

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
  const [session] = useSession()
  const router = useRouter()
  const client = useApolloClient()
  const [setName] = useMutation(NAME_MUTATION)

  const Satistics = () => <h1 className='ml-2'><small className='text-success'>{user.sats} sats \ {user.stacked} stacked</small></h1>

  const UserSchema = Yup.object({
    name: Yup.string()
      .required('required')
      .matches(/^[\w_]+$/, 'only letters, numbers, and _')
      .max(32, 'too long')
      .test({
        name: 'name',
        test: async name => {
          if (!name || !name.length) return false
          const { data } = await client.query({ query: NAME_QUERY, variables: { name } })
          return data.nameAvailable
        },
        message: 'taken'
      })
  })

  return (
    <>
      {editting
        ? (
          <Form
            className='d-flex align-items-center flex-wrap'
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
              router.replace(`/${name}`)
              session.user.name = name

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
            <Input
              prepend=<InputGroup.Text>@</InputGroup.Text>
              name='name'
              autoFocus
              groupClassName={`mb-0 ${styles.username}`}
              showValid
            />
            <Satistics user={user} />
            <SubmitButton className='ml-2' variant='info' size='sm' onClick={() => setEditting(true)}>save</SubmitButton>
          </Form>
          )
        : (
          <div className='d-flex align-items-center flex-wrap'>
            <h1>@{user.name}</h1>
            <Satistics user={user} />
            {session && session.user && session.user.name === user.name &&
              <Button className='ml-2' variant='boost' size='sm' onClick={() => setEditting(true)}>edit</Button>}
          </div>
          )}
      <Nav
        activeKey={router.asPath}
      >
        <Nav.Item>
          <Link href={'/' + user.name} passHref>
            <Nav.Link>{user.nitems} posts</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href={'/' + user.name + '/comments'} passHref>
            <Nav.Link>{user.ncomments} comments</Nav.Link>
          </Link>
        </Nav.Item>
        {/* <Nav.Item>
          <Link href={'/' + user.name + '/sativity'} passHref>
            <Nav.Link>sativity</Nav.Link>
          </Link>
        </Nav.Item> */}
      </Nav>
    </>
  )
}
