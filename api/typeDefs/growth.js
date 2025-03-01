import { gql } from 'graphql-tag'

export default gql`
  type NameValue {
    name: String!
    value: Float!
  }

  extend type Query {
    registrationGrowth(when: String, from: String, to: String): [TimeData!]!
    itemGrowth(when: String, from: String, to: String): [TimeData!]!
    spendingGrowth(when: String, from: String, to: String): [TimeData!]!
    spenderGrowth(when: String, from: String, to: String): [TimeData!]!
    stackingGrowth(when: String, from: String, to: String): [TimeData!]!
    stackerGrowth(when: String, from: String, to: String): [TimeData!]!
    itemGrowthSubs(when: String, from: String, to: String, sub: String): [TimeData!]!
    revenueGrowthSubs(when: String, from: String, to: String, sub: String): [TimeData!]!
  }

  type TimeData {
    time: Date!
    data: [NameValue!]!
  }
`
