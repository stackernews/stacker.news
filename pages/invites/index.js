import Layout from '../../components/layout'
import * as Yup from 'yup'
import { Form, Input, SubmitButton } from '../../components/form'
import { InputGroup } from 'react-bootstrap'
import { gql, useMutation, useQuery } from '@apollo/client'
import { INVITE_FIELDS } from '../../fragments/invites'
import AccordianItem from '../../components/accordian-item'
import styles from '../../styles/invites.module.css'
import Invite from '../../components/invite'

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
      onSubmit={async ({ limit, gift }) => {
        const { error } = await createInvite({
          variables: {
            gift: Number(gift), limit: limit ? Number(limit) : limit
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
      />
      <Input
        label={<>invitee limit <small className='text-muted ml-2'>optional</small></>}
        name='limit'
      />

      <SubmitButton variant='secondary'>create</SubmitButton>
    </Form>
  )
}

function InviteList ({ name, invites }) {
  return (
    <div className='mt-4'>
      <AccordianItem
        show
        headerColor='#6c757d'
        header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>{name}</div>} body={
          <div className={styles.invites}>{invites.map(invite => {
            return <Invite invite={invite} key={invite.id} active={name === 'active'} />
          })}
          </div>
        }
      />
    </div>
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
    `, { fetchPolicy: 'cache-and-network' })

  const [active, inactive] = data && data.invites
    ? data.invites.reduce((result, invite) => {
        result[
          invite.revoked || (invite.limit &&
            invite.invitees.length >= invite.limit)
            ? 1
            : 0].push(invite)
        return result
      },
      [[], []])
    : [[], []]

  return (
    <Layout>
      <h2 className='text-center mt-3'>invite links</h2>
      <InviteForm />
      {active.length > 0 && <InviteList name='active' invites={active} />}
      {inactive.length > 0 && <InviteList name='inactive' invites={inactive} />}
    </Layout>
  )
}
