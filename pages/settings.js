import { Checkbox, Form, Input, SubmitButton } from '../components/form'
import * as Yup from 'yup'
import { Alert, Button, InputGroup } from 'react-bootstrap'
import { useMe } from '../components/me'
import LayoutCenter from '../components/layout-center'
import { useState } from 'react'
import { gql, useMutation } from '@apollo/client'
import { getGetServerSideProps } from '../api/ssrApollo'

export const getServerSideProps = getGetServerSideProps()

export const SettingsSchema = Yup.object({
  tipDefault: Yup.number().typeError('must be a number').required('required')
    .positive('must be positive').integer('must be whole')
})

export default function Settings () {
  const me = useMe()
  const [success, setSuccess] = useState()
  const [setSettings] = useMutation(
    gql`
      mutation setSettings($tipDefault: Int!, $noteItemSats: Boolean!, $noteEarning: Boolean!,
        $noteAllDescendants: Boolean!, $noteMentions: Boolean!, $noteDeposits: Boolean!,
        $noteInvites: Boolean!, $noteJobIndicator: Boolean!) {
        setSettings(tipDefault: $tipDefault, noteItemSats: $noteItemSats,
          noteEarning: $noteEarning, noteAllDescendants: $noteAllDescendants,
          noteMentions: $noteMentions, noteDeposits: $noteDeposits, noteInvites: $noteInvites,
          noteJobIndicator: $noteJobIndicator)
      }`
  )

  return (
    <LayoutCenter>
      <h2 className='mb-5 text-left'>settings</h2>
      <Form
        initial={{
          tipDefault: me?.tipDefault || 21,
          noteItemSats: me?.noteItemSats,
          noteEarning: me?.noteEarning,
          noteAllDescendants: me?.noteAllDescendants,
          noteMentions: me?.noteMentions,
          noteDeposits: me?.noteDeposits,
          noteInvites: me?.noteInvites,
          noteJobIndicator: me?.noteJobIndicator
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
        <div className='form-label'>saturday newsletter</div>
        <Button href='https://mail.stacker.news/subscription/form' target='_blank'>(re)subscribe</Button>
        <div className='d-flex'>
          <SubmitButton variant='info' className='ml-auto mt-1 px-4'>save</SubmitButton>
        </div>
      </Form>
    </LayoutCenter>
  )
}
