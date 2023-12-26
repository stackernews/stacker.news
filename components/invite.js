// ... (existing code)

const CopyInputWithDefaults = ({ ...props }) => (
  <CopyInput
    groupClassName={`mb-1 ${props.groupClassName || ''}`}
    size={props.size || 'sm'}
    type={props.type || 'text'}
    placeholder={`https://stacker.news/invites/${invite.id}`}
    readOnly
    noForm
    {...props}
  />
);

const RevokeSection = () => (
  <>
    <span> \ </span>
    <span
      className={styles.revoke}
      onClick={() => revokeInvite({ variables: { id: invite.id } })}
      role="button"
      aria-label="Revoke Invitation"
    >
      revoke
    </span>
  </>
);

const renderRevokedSection = () => (
  <>
    <span> \ </span>
    <span
      className='text-danger'
      aria-label="Invitation Revoked"
    >
      revoked
    </span>
  </>
);

if (!invite) {
  return null; // Returns null if invite is not defined
}

return (
  <div className={styles.invite} role="listitem">
    <CopyInputWithDefaults />
    <div className={styles.other} role="status">
      <span>{invite.gift} sat gift</span>
      <span> \ </span>
      <span>{invite.invitees.length} joined{invite.limit ? ` of ${invite.limit}` : ''}</span>
      {active ? <RevokeSection /> : (invite.revoked && renderRevokedSection())}
    </div>
  </div>
);
