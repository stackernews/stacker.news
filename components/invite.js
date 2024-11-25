import { CopyInput } from './form'
import { gql, useMutation } from '@apollo/client'
import { INVITE_FIELDS } from '@/fragments/invites'
import styles from '@/styles/invites.module.css'

export default function Invite ({ invite, active }) {
  const [revokeInvite] = useMutation(
    gql`
      ${INVITE_FIELDS}
      mutation revokeInvite($id: ID!) {
        revokeInvite(id: $id) {
          ...InviteFields
        }
      }`
  )

  return (
    <div
      className={styles.invite}
    >
      <CopyInput
        groupClassName='mb-1'
        size='sm' type='text'
        placeholder={`${process.env.NEXT_PUBLIC_URL}/invites/${invite.id}`} readOnly noForm
      />
      {invite.description && <small className='text-muted'>{invite.description}</small>}
      <div className={styles.other}>
        <span>{invite.gift} sat gift</span>
        <span> \ </span>
        <span>{invite.invitees.length} joined{invite.limit ? ` of ${invite.limit}` : ''}</span>
        {active
          ? (
            <>
              <span> \ </span>
              <span
                className={styles.revoke}
                onClick={() => revokeInvite({ variables: { id: invite.id } })}
              >revoke
              </span>
            </>)

          : invite.revoked && (
            <>
              <span> \ </span>
              <span
                className='text-danger'
              >revoked
              </span>
            </>)}
      </div>
    </div>
  )
}
