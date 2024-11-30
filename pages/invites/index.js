import Layout from '@/components/layout'
import { Form, Input, SubmitButton } from '@/components/form'
import InputGroup from 'react-bootstrap/InputGroup'
import { gql, useMutation, useQuery } from '@apollo/client'
import { INVITE_FIELDS } from '@/fragments/invites'
import AccordianItem from '@/components/accordian-item'
import styles from '@/styles/invites.module.css'
import Invite from '@/components/invite'
import { inviteSchema } from '@/lib/validate'
import { SSR } from '@/lib/constants'
import { getGetServerSideProps } from '@/api/ssrApollo'

// force SSR to include CSP nonces
export const getServerSideProps = getGetServerSideProps({ query: null })

function InviteForm () {
  const [createInvite] = useMutation(
    gql`
      ${INVITE_FIELDS}
      mutation createInvite($id: String, $gift: Int!, $limit: Int, $description: String) {
        createInvite(id: $id, gift: $gift, limit: $limit, description: $description) {
          ...InviteFields
        }
      }`, {
      update (cache, { data: { createInvite } }) {
        cache.modify({
          fields: {
            invites (existingInviteRefs = []) {
              const newInviteRef = cache.writeFragment({
                fragmentName: 'InviteFields',
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
        id: undefined,
        gift: 100,
        limit: 1,
        description: undefined
      }}
      schema={inviteSchema}
      onSubmit={async ({ id, gift, limit, description }) => {
        const { error } = await createInvite({
          variables: {
            id: id || undefined,
            gift: Number(gift),
            limit: limit ? Number(limit) : limit,
            description: description || undefined
          }
        })
        if (error) throw error
      }}
    >
      <Input
        label='gift'
        name='gift'
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        required
      />
      <Input
        label={<>invitee limit <small className='text-muted ms-2'>optional</small></>}
        name='limit'
      />
      <AccordianItem
        headerColor='#6c757d' header='advanced' body={
          <>
            <Input
              prepend={<InputGroup.Text className='text-muted'>{`${process.env.NEXT_PUBLIC_URL}/invites/`}</InputGroup.Text>}
              label={<>invite code <small className='text-muted ms-2'>optional</small></>}
              name='id'
              autocomplete='off'
            />
            <Input
              label={<>description <small className='text-muted ms-2'>optional</small></>}
              name='description'
              autocomplete='off'
            />
          </>
      }
      />
      <SubmitButton
        className='mt-4'
        variant='secondary'
      >create
      </SubmitButton>
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
    `, SSR ? {} : { fetchPolicy: 'cache-and-network' })

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
      <div className='text-center'>
        <h2 className='mt-3 mb-0'>
          invite links
        </h2>
        <small className='d-block text-muted fw-bold mx-5'>send these to people you trust, e.g. group chats or DMs</small>
      </div>
      <InviteForm />
      {active.length > 0 && <InviteList name='active' invites={active} />}
      {inactive.length > 0 && <InviteList name='inactive' invites={inactive} />}
    </Layout>
  )
}
