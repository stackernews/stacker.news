import { Form, Input, SubmitButton } from '../components/form'
import * as Yup from 'yup'
import { Alert, InputGroup } from 'react-bootstrap'
import { useMe } from '../components/me'
import LayoutCenter from '../components/layout-center'
import { useState } from 'react'
import { gql, useMutation } from '@apollo/client'

export const SettingsSchema = Yup.object({
  tipDefault: Yup.number().typeError('must be a number').required('required')
    .positive('must be positive').integer('must be whole')
})

export default function Settings () {
  const me = useMe()
  const [success, setSuccess] = useState()
  const [setSettings] = useMutation(
    gql`
      mutation setSettings($tipDefault: Int!) {
        setSettings(tipDefault: $tipDefault)
      }`
  )

  return (
    <LayoutCenter noFooterLinks>
      <h2 className='mb-5 text-left'>settings</h2>
      <Form
        initial={{
          tipDefault: me?.tipDefault || 21
        }}
        schema={SettingsSchema}
        onSubmit={async ({ tipDefault }) => {
          await setSettings({ variables: { tipDefault: Number(tipDefault) } })
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
        <div className='d-flex'>
          <SubmitButton variant='info' className='ml-auto mt-1 px-4'>save</SubmitButton>
        </div>
      </Form>
    </LayoutCenter>
  )
}
