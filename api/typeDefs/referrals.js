import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    referrals(when: String): Referrals!
  }

  type Referrals {
    totalSats: Int!
    totalReferrals: Int!
    stats: [TimeData!]!
  }
`
