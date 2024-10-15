import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    referrals(when: String, from: String, to: String): [TimeData!]!
  }
`
