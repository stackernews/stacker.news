import { gql } from '@apollo/client'

export const INVITE_FIELDS = gql`
  fragment InviteFields on Invite {
    id
    createdAt
    invitees {
      name
      id
    }
    gift
    limit
    revoked
    user {
      name
      id
    }
    poor
  }
`
