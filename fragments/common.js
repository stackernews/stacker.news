import { gql } from '@apollo/client'

export const STREAK_FIELDS = gql`
  fragment StreakFields on User {
    optional {
      streak
      hasSendWallet
      hasRecvWallet
    }
  }
`
