import Layout from '../../components/layout'
import * as Yup from 'yup'
import { Form, Input, SubmitButton } from '../../components/form'
import { InputGroup } from 'react-bootstrap'
import { gql, useMutation, useQuery } from '@apollo/client'
import { INVITE_FIELDS } from '../../fragments/invites'

export const InviteSchema = Yup.object({
  gift: Yup.number().typeError('must be a number')
    .min(0, 'must be positive').integer('must be whole').required(),
  limit: Yup.number().typeError('must be a number')
    .positive('must be positive').integer('must be whole')
})

function InviteForm () {
  const [createInvite] = useMutation(
    gql`
      ${INVITE_FIELDS}
      mutation createInvite($gift: Int!, $limit: Int) {
        createInvite(gift: $gift, limit: $limit) {
          ...InviteFields
        }
      }`, {
      update (cache, { data: { createInvite } }) {
        cache.modify({
          fields: {
            invites (existingInviteRefs = []) {
              const newInviteRef = cache.writeFragment({
                data: createInvite,
                fragment: INVITE_FIELDS
              })
              return [newInviteRef, ...existingInviteRefs]
            }
          }
        })
      }
    }
  )

  return (
    <Form
      initial={{
        gift: 100,
        limit: undefined
      }}
      schema={InviteSchema}
      onSubmit={async ({ limit, ...values }) => {
        const { error } = await createInvite({
          variables: {
            ...values, limit: limit ? Number(limit) : limit
          }
        })
        if (error) {
          throw new Error({ message: error.String() })
        }
      }}
    >
      <Input
        label='gift'
        name='gift'
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        required
        autoFocus
      />
      <Input
        label={<>invitee limit <small className='text-muted ml-2'>optional</small></>}
        name='limit'
      />

      <SubmitButton variant='secondary' className='mt-2'>create</SubmitButton>
    </Form>
  )
}

export default function Invites () {
  const { data } = useQuery(
    gql`
      ${INVITE_FIELDS}
      {
        invites {
          ...InviteFields
        }
      }
    `)
  return (
    <Layout>
      <InviteForm />
      {data && data.invites && data.invites.map(invite => {
        return <div key={invite.id}>{invite.id}</div>
      })}
    </Layout>
  )
}
