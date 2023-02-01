import { Button, InputGroup, Image } from 'react-bootstrap'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Nav from 'react-bootstrap/Nav'
import { useState } from 'react'
import { Form, Input, SubmitButton } from './form'
import * as Yup from 'yup'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import styles from './user-header.module.css'
import { useMe } from './me'
import { NAME_MUTATION, NAME_QUERY } from '../fragments/users'
import QRCode from 'qrcode.react'
import LightningIcon from '../svgs/bolt.svg'
import ModalButton from './modal-button'
import { encodeLNUrl } from '../lib/lnurl'
import Avatar from './avatar'
import CowboyHat from './cowboy-hat'

export default function UserHeader ({ user }) {
  const [editting, setEditting] = useState(false)
  const me = useMe()
  const router = useRouter()
  const client = useApolloClient()
  const [setName] = useMutation(NAME_MUTATION)

  const [setPhoto] = useMutation(
    gql`
      mutation setPhoto($photoId: ID!) {
        setPhoto(photoId: $photoId)
      }`, {
      update (cache, { data: { setPhoto } }) {
        cache.modify({
          id: `User:${user.id}`,
          fields: {
            photoId () {
              return setPhoto
            }
          }
        })
      }
    }
  )

  const isMe = me?.name === user.name
  const Satistics = () => <div className={`mb-2 ml-0 ml-sm-1 ${styles.username} text-success`}>{isMe ? `${user.sats} sats \\ ` : ''}{user.stacked} stacked</div>

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

  const lnurlp = encodeLNUrl(new URL(`https://stacker.news/.well-known/lnurlp/${user.name}`))

  return (
    <>
      <div className='d-flex mt-2 flex-wrap flex-column flex-sm-row'>
        <div className='position-relative' style={{ width: 'fit-content' }}>
          <Image
            src={user.photoId ? `https://${process.env.NEXT_PUBLIC_AWS_UPLOAD_BUCKET}.s3.amazonaws.com/${user.photoId}` : '/dorian400.jpg'} width='135' height='135'
            className={styles.userimg}
          />
          {isMe &&
            <Avatar onSuccess={async photoId => {
              const { error } = await setPhoto({ variables: { photoId } })
              if (error) {
                console.log(error)
              }
            }}
            />}
        </div>
        <div className='ml-0 ml-sm-1 mt-3 mt-sm-0 justify-content-center align-self-sm-center'>
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

                  const { nodata, ...query } = router.query
                  router.replace({
                    pathname: router.pathname,
                    query: { ...query, name }
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
                <div className='d-flex align-items-center mb-2'>
                  <Input
                    prepend=<InputGroup.Text>@</InputGroup.Text>
                    name='name'
                    autoFocus
                    groupClassName={styles.usernameForm}
                    showValid
                  />
                  <SubmitButton variant='link' onClick={() => setEditting(true)}>save</SubmitButton>
                </div>
              </Form>
              )
            : (
              <div className='d-flex align-items-center mb-2'>
                <div className={styles.username}>@{user.name}<CowboyHat className='' streak={user.streak} badge /></div>
                {isMe &&
                  <Button className='py-0' style={{ lineHeight: '1.25' }} variant='link' onClick={() => setEditting(true)}>edit nym</Button>}
              </div>
              )}
          <Satistics user={user} />
          <ModalButton
            clicker={
              <Button className='font-weight-bold ml-0 ml-sm-2'>
                <LightningIcon
                  width={20}
                  height={20}
                  className='mr-1'
                />{user.name}@stacker.news
              </Button>
            }
          >
            <a className='d-flex m-auto p-3' style={{ background: 'white', width: 'fit-content' }} href={`lightning:${lnurlp}`}>
              <QRCode className='d-flex m-auto' value={lnurlp} renderAs='svg' size={300} />
            </a>
            <div className='text-center font-weight-bold text-muted mt-3'>click or scan</div>
          </ModalButton>
        </div>
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
