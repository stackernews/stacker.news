import { gql } from '@apollo/client'
import { STREAK_FIELDS } from './users'

export const INVITE_FIELDS = gql`
  ${STREAK_FIELDS}
  fragment InviteFields on Invite {
    id
    createdAt
    gift
    limit
    giftedCount
    full
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

export const PUBLIC_INVITE_FIELDS = gql`
  fragment PublicInviteFields on Invite {
    id
    gift
    revoked
    full
    user {
      id
      name
    }
    poor
  }
`
