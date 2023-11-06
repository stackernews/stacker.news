import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import Image from 'react-bootstrap/Image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Nav from 'react-bootstrap/Nav'
import { useState } from 'react'
import { Form, Input } from './form'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import styles from './user-header.module.css'
import { useMe } from './me'
import { NAME_MUTATION } from '../fragments/users'
import QRCode from 'qrcode.react'
import LightningIcon from '../svgs/bolt.svg'
import { encodeLNUrl } from '../lib/lnurl'
import Avatar from './avatar'
import { userSchema } from '../lib/validate'
import { useShowModal } from './modal'
import { numWithUnits } from '../lib/format'
import Hat from './hat'
import SubscribeUserDropdownItem from './subscribeUser'
import ActionDropdown from './action-dropdown'
import CodeIcon from '../svgs/terminal-box-fill.svg'
import MuteDropdownItem from './mute'
import copy from 'clipboard-copy'
import { useToast } from './toast'
import { EditNymFeeButton } from './fee-button'

export default function UserHeader ({ user }) {
  const router = useRouter()

  return (
    <>
      <HeaderHeader user={user} />
      <Nav
        className={styles.nav}
        activeKey={!!router.asPath.split('/')[2]}
      >
        <Nav.Item>
          <Link href={'/' + user.name} passHref legacyBehavior>
            <Nav.Link eventKey={false}>bio</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href={'/' + user.name + '/all'} passHref legacyBehavior>
            <Nav.Link eventKey>
              {numWithUnits(user.nitems, {
                abbreviate: false,
                unitSingular: 'item',
                unitPlural: 'items'
              })}
            </Nav.Link>
          </Link>
        </Nav.Item>
      </Nav>
    </>
  )
}

function HeaderPhoto ({ user, isMe }) {
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

  return (
    <div className='position-relative align-self-start' style={{ width: 'fit-content' }}>
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
  )
}

function NymEdit ({ user, setEditting }) {
  const router = useRouter()
  const [setName] = useMutation(NAME_MUTATION, {
    update (cache, { data: { setName } }) {
      cache.modify({
        id: `User:${user.id}`,
        fields: {
          name () {
            return setName
          }
        }
      })
    }
  })
  const client = useApolloClient()
  const schema = userSchema({ client })

  return (
    <Form
      schema={schema}
      initial={{
        name: user.name
      }}
      invoiceable
      validateImmediately
      validateOnChange={false}
      onSubmit={async ({ name, hash, hmac }) => {
        if (name === user.name) {
          setEditting(false)
          return
        }
        const { error } = await setName({ variables: { name, hash, hmac } })
        if (error) {
          throw new Error({ message: error.toString() })
        }

        setEditting(false)
        // navigate to new name
        const { nodata, ...query } = router.query
        router.replace({
          pathname: router.pathname,
          query: { ...query, name }
        }, undefined, { shallow: true })
      }}
    >
      <div className='d-flex align-items-center mb-2'>
        <Input
          prepend=<InputGroup.Text>@</InputGroup.Text>
          name='name'
          autoFocus
          groupClassName={styles.usernameForm}
          showValid
          debounce={500}
        />
      </div>
      <div className='d-flex justify-content-start mb-2'>
        <Button variant='grey-medium' onClick={() => setEditting(false)} className='me-2'>cancel</Button>
        <EditNymFeeButton onClick={() => setEditting(true)} />
      </div>
    </Form>
  )
}

function NymView ({ user, isMe, setEditting }) {
  const me = useMe()
  return (
    <div className='d-flex align-items-center mb-2'>
      <div className={styles.username}>@{user.name}<Hat className='' user={user} badge /></div>
      {isMe &&
        <Button className='py-0' style={{ lineHeight: '1.25' }} variant='link' onClick={() => setEditting(true)}>edit nym</Button>}
      {!isMe && me &&
        <div className='ms-2'>
          <ActionDropdown>
            <SubscribeUserDropdownItem user={user} target='posts' />
            <SubscribeUserDropdownItem user={user} target='comments' />
            <MuteDropdownItem user={user} />
          </ActionDropdown>
        </div>}
    </div>
  )
}

function HeaderNym ({ user, isMe }) {
  const [editting, setEditting] = useState(false)

  return editting
    ? <NymEdit user={user} setEditting={setEditting} />
    : <NymView user={user} isMe={isMe} setEditting={setEditting} />
}

function HeaderHeader ({ user }) {
  const me = useMe()
  const showModal = useShowModal()
  const toaster = useToast()

  const isMe = me?.name === user.name
  const Satistics = () => (
    <div className={`mb-2 ms-0 ms-sm-1 ${styles.username} text-success`}>
      {numWithUnits(user.stacked, { abbreviate: false, format: true })} stacked
    </div>)

  const lnurlp = encodeLNUrl(new URL(`https://stacker.news/.well-known/lnurlp/${user.name}`))
  return (
    <div className='d-flex mt-2 flex-wrap flex-column flex-sm-row'>
      <HeaderPhoto user={user} isMe={isMe} />
      <div className='ms-0 ms-sm-3 mt-3 mt-sm-0 justify-content-center align-self-sm-center'>
        <HeaderNym user={user} isMe={isMe} />
        <Satistics user={user} />
        <Button
          className='fw-bold ms-0' onClick={() => {
            copy(`${user.name}@stacker.news`)
              .then(() => {
                toaster.success(`copied ${user.name}@stacker.news to clipboard`)
              }).catch(() => {
                toaster.error(`failed to copy ${user.name}@stacker.news to clipboard`)
              })
            showModal(({ onClose }) => (
              <>
                <a className='d-flex m-auto p-3' style={{ background: 'white', maxWidth: 'fit-content' }} href={`lightning:${lnurlp}`}>
                  <QRCode className='d-flex m-auto' value={lnurlp} renderAs='svg' size={300} />
                </a>
                <div className='text-center fw-bold text-muted mt-3'>click or scan</div>
              </>
            ))
          }}
        >
          <LightningIcon
            width={20}
            height={20}
            className='me-1'
          />{user.name}@stacker.news
        </Button>
        <div className='d-flex flex-column mt-1 ms-0'>
          <small className='text-muted d-flex-inline'>stacking since: {user.since
            ? <Link href={`/items/${user.since}`} className='ms-1'>#{user.since}</Link>
            : <span>never</span>}
          </small>
          <small className='text-muted d-flex-inline'>longest cowboy streak: {user.maxStreak !== null ? user.maxStreak : 'none'}</small>
          {user.isContributor && <small className='text-muted d-flex align-items-center'><CodeIcon className='me-1' height={16} width={16} /> verified stacker.news contributor</small>}
        </div>
      </div>
    </div>
  )
}
