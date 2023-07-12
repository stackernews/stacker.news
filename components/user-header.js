import { Button, InputGroup, Image } from 'react-bootstrap'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Nav from 'react-bootstrap/Nav'
import { useState } from 'react'
import { Form, Input, SubmitButton } from './form'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import styles from './user-header.module.css'
import { useMe } from './me'
import { NAME_MUTATION } from '../fragments/users'
import QRCode from 'qrcode.react'
import LightningIcon from '../svgs/bolt.svg'
import ModalButton from './modal-button'
import { encodeLNUrl } from '../lib/lnurl'
import Avatar from './avatar'
import CowboyHat from './cowboy-hat'
import { userSchema } from '../lib/validate'

export default function UserHeader ({ user }) {
  const [editting, setEditting] = useState(false)
  const me = useMe()
  const router = useRouter()
  const client = useApolloClient()
  const schema = userSchema(client)
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
        <div className='ml-0 ml-sm-3 mt-3 mt-sm-0 justify-content-center align-self-sm-center'>
          {editting
            ? (
              <Form
                schema={schema}
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
                <div className={styles.username}>@{user.name}<CowboyHat className='' user={user} badge /></div>
                {isMe &&
                  <Button className='py-0' style={{ lineHeight: '1.25' }} variant='link' onClick={() => setEditting(true)}>edit nym</Button>}
              </div>
              )}
          <Satistics user={user} />
          <ModalButton
            clicker={
              <Button className='font-weight-bold ml-0'>
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
          <div className='d-flex flex-column mt-1 ml-0'>
            <small className='text-muted d-flex-inline'>stacking since: {user.since
              ? <Link href={`/items/${user.since}`} passHref><a className='ml-1'>#{user.since}</a></Link>
              : <span>never</span>}
            </small>
            <small className='text-muted d-flex-inline'>longest cowboy streak: {user.maxStreak !== null ? user.maxStreak : 'none'}</small>
          </div>
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
        <Nav.Item>
          <Link href={'/' + user.name + '/bookmarks'} passHref>
            <Nav.Link>{user.nbookmarks} bookmarks</Nav.Link>
          </Link>
        </Nav.Item>
      </Nav>
    </>
  )
}
