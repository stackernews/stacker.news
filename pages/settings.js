import { Checkbox, Form, Input, SubmitButton } from '../components/form'
import * as Yup from 'yup'
import { Alert, Button, InputGroup, Modal } from 'react-bootstrap'
import LayoutCenter from '../components/layout-center'
import { useState } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { getGetServerSideProps } from '../api/ssrApollo'
import LoginButton from '../components/login-button'
import { signIn } from 'next-auth/client'
import ModalButton from '../components/modal-button'
import { LightningAuth } from '../components/lightning-auth'
import { SETTINGS } from '../fragments/users'
import { useRouter } from 'next/router'
import Info from '../components/info'

export const getServerSideProps = getGetServerSideProps(SETTINGS)

export const SettingsSchema = Yup.object({
  tipDefault: Yup.number().typeError('must be a number').required('required')
    .positive('must be positive').integer('must be whole')
})

const warningMessage = 'If I logout, even accidentally, I will never be able to access my account again'

export const WarningSchema = Yup.object({
  warning: Yup.string().matches(warningMessage, 'does not match').required('required')
})

export default function Settings ({ data: { settings } }) {
  const [success, setSuccess] = useState()
  const [setSettings] = useMutation(
    gql`
      mutation setSettings($tipDefault: Int!, $noteItemSats: Boolean!, $noteEarning: Boolean!,
        $noteAllDescendants: Boolean!, $noteMentions: Boolean!, $noteDeposits: Boolean!,
        $noteInvites: Boolean!, $noteJobIndicator: Boolean!, $hideInvoiceDesc: Boolean!) {
        setSettings(tipDefault: $tipDefault, noteItemSats: $noteItemSats,
          noteEarning: $noteEarning, noteAllDescendants: $noteAllDescendants,
          noteMentions: $noteMentions, noteDeposits: $noteDeposits, noteInvites: $noteInvites,
          noteJobIndicator: $noteJobIndicator, hideInvoiceDesc: $hideInvoiceDesc)
      }`
  )

  const { data } = useQuery(SETTINGS)
  if (data) {
    ({ settings } = data)
  }

  return (
    <LayoutCenter>
      <div className='py-3 w-100'>
        <h2 className='mb-2 text-left'>settings</h2>
        <Form
          initial={{
            tipDefault: settings?.tipDefault || 21,
            noteItemSats: settings?.noteItemSats,
            noteEarning: settings?.noteEarning,
            noteAllDescendants: settings?.noteAllDescendants,
            noteMentions: settings?.noteMentions,
            noteDeposits: settings?.noteDeposits,
            noteInvites: settings?.noteInvites,
            noteJobIndicator: settings?.noteJobIndicator,
            hideInvoiceDesc: settings?.hideInvoiceDesc
          }}
          schema={SettingsSchema}
          onSubmit={async ({ tipDefault, ...values }) => {
            await setSettings({ variables: { tipDefault: Number(tipDefault), ...values } })
            setSuccess('settings saved')
          }}
        >
          {success && <Alert variant='info' onClose={() => setSuccess(undefined)} dismissible>{success}</Alert>}
          <Input
            label='tip default'
            name='tipDefault'
            required
            autoFocus
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
          <div className='form-label'>notify me when ...</div>
          <Checkbox
            label='I stack sats from posts and comments'
            name='noteItemSats'
            groupClassName='mb-0'
          />
          <Checkbox
            label='I get a daily airdrop'
            name='noteEarning'
            groupClassName='mb-0'
          />
          <Checkbox
            label='someone replies to someone who replied to me'
            name='noteAllDescendants'
            groupClassName='mb-0'
          />
          <Checkbox
            label='my invite links are redeemed'
            name='noteInvites'
            groupClassName='mb-0'
          />
          <Checkbox
            label='sats are deposited in my account'
            name='noteDeposits'
            groupClassName='mb-0'
          />
          <Checkbox
            label='someone mentions me'
            name='noteMentions'
            groupClassName='mb-0'
          />
          <Checkbox
            label='there is a new job'
            name='noteJobIndicator'
          />
          <div className='form-label'>privacy</div>
          <Checkbox
            label={
              <>hide invoice descriptions
                <Info>
                  <ul className='font-weight-bold'>
                    <li>Use this if you don't want funding sources to be linkable to your SN identity.</li>
                    <li>It makes your invoice descriptions blank.</li>
                    <li>This only applies to invoices you create
                      <ul>
                        <li>lnurl-pay and lightning addresses still reference your nym</li>
                      </ul>
                    </li>
                  </ul>
                </Info>
              </>
            }
            name='hideInvoiceDesc'
          />
          <div className='d-flex'>
            <SubmitButton variant='info' className='ml-auto mt-1 px-4'>save</SubmitButton>
          </div>
        </Form>
        <div className='text-left w-100'>
          <div className='form-label'>saturday newsletter</div>
          <Button href='https://mail.stacker.news/subscription/form' target='_blank'>(re)subscribe</Button>
          {settings?.authMethods && <AuthMethods methods={settings.authMethods} />}
        </div>
      </div>
    </LayoutCenter>
  )
}

function AuthMethods ({ methods }) {
  const router = useRouter()
  const [unlinkAuth] = useMutation(
    gql`
      mutation unlinkAuth($authType: String!) {
        unlinkAuth(authType: $authType) {
          lightning
          email
          twitter
          github
        }
      }`, {
      update (cache, { data: { unlinkAuth } }) {
        cache.modify({
          id: 'ROOT_QUERY',
          fields: {
            settings (existing) {
              return { ...existing, authMethods: { ...unlinkAuth } }
            }
          }
        })
      }
    }
  )
  const [obstacle, setObstacle] = useState()

  const unlink = async type => {
    // if there's only one auth method left
    let links = 0
    links += methods.lightning ? 1 : 0
    links += methods.email ? 1 : 0
    links += methods.twitter ? 1 : 0
    links += methods.github ? 1 : 0

    if (links === 1) {
      setObstacle(type)
    } else {
      await unlinkAuth({ variables: { authType: type } })
    }
  }

  return (
    <>
      <Modal
        show={obstacle}
        onHide={() => setObstacle(null)}
      >
        <div className='modal-close' onClick={() => setObstacle(null)}>X</div>
        <Modal.Body>
          You are removing your last auth method. It is recommended you link another auth method before removing
          your last auth method. If you'd like to proceed anyway, type the following below
          <div className='text-danger font-weight-bold my-2'>
            If I logout, even accidentally, I will never be able to access my account again
          </div>
          <Form
            className='mt-3'
            initial={{
              warning: ''
            }}
            schema={WarningSchema}
            onSubmit={async () => {
              await unlinkAuth({ variables: { authType: obstacle } })
              router.push('/settings')
              setObstacle(null)
            }}
          >
            <Input
              name='warning'
              required
            />
            <SubmitButton className='d-flex ml-auto' variant='danger'>do it</SubmitButton>
          </Form>
        </Modal.Body>
      </Modal>
      <div className='form-label mt-3'>auth methods</div>
      {methods.lightning
        ? <LoginButton
            className='d-block' type='lightning' text='Unlink' onClick={
          async () => {
            await unlink('lightning')
          }
        }
          />
        : (
          <ModalButton clicker={<LoginButton className='d-block' type='lightning' text='Link' />}>
            <div className='d-flex flex-column align-items-center'>
              <LightningAuth />
            </div>
          </ModalButton>)}
      <LoginButton
        className='d-block mt-2' type='twitter' text={methods.twitter ? 'Unlink' : 'Link'} onClick={
        async () => {
          if (methods.twitter) {
            await unlink('twitter')
          } else {
            signIn('twitter')
          }
        }
      }
      />
      <LoginButton
        className='d-block mt-2' type='github' text={methods.github ? 'Unlink' : 'Link'} onClick={
        async () => {
          if (methods.github) {
            await unlink('github')
          } else {
            signIn('github')
          }
        }
      }
      />
      {methods.email
        ? (
          <div className='mt-2 d-flex align-items-center'>
            <Input
              name='email'
              placeholder={methods.email}
              groupClassName='mb-0'
              readOnly
              noForm
            />
            <Button
              className='ml-2' variant='secondary' onClick={
              async () => {
                await unlink('email')
              }
            }
            >Unlink Email
            </Button>
          </div>
          )
        : <div className='mt-2'><EmailLinkForm /></div>}
    </>
  )
}

export const EmailSchema = Yup.object({
  email: Yup.string().email('email is no good').required('required')
})

export function EmailLinkForm ({ callbackUrl }) {
  const [linkUnverifiedEmail] = useMutation(
    gql`
      mutation linkUnverifiedEmail($email: String!) {
        linkUnverifiedEmail(email: $email)
      }`
  )

  return (
    <Form
      initial={{
        email: ''
      }}
      schema={EmailSchema}
      onSubmit={async ({ email }) => {
        // add email to user's account
        // then call signIn
        const { data } = await linkUnverifiedEmail({ variables: { email } })
        if (data.linkUnverifiedEmail) {
          signIn('email', { email, callbackUrl })
        }
      }}
    >
      <div className='d-flex align-items-center'>
        <Input
          name='email'
          placeholder='email@example.com'
          required
          groupClassName='mb-0'
        />
        <SubmitButton className='ml-2' variant='secondary'>Link Email</SubmitButton>
      </div>
    </Form>
  )
}
