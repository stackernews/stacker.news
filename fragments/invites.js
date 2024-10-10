import { gql } from '@apollo/client'

export const INVITE_FIELDS = gql`
  fragment InviteFields on Invite {
    id
    createdAt
    invitees {
      id
      name
    }
    gift
    limit
    revoked
    user {
      id
      name
      optional {
        streak
        gunStreak
        horseStreak
      }
    }
    poor
  }
`
