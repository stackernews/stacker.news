import { gql } from '@apollo/client'
import { STREAK_FIELDS } from './users'

export const INVITE_FIELDS = gql`
  ${STREAK_FIELDS}
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
      ...StreakFields
    }
    poor
    description
  }
`
