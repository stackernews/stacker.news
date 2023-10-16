import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    referrals(when: String, from: String, to: String): Referrals!
  }

  type Referrals {
    totalSats: Int!
    totalReferrals: Int!
    stats: [TimeData!]!
  }
`
