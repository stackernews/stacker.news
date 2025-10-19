import { gql } from 'graphql-tag'

export default gql`
  type NameValue {
    name: String!
    value: Float!
  }

  extend type Query {
    registrationGrowth(when: String, from: String, to: String): [TimeData!]!
    itemGrowth(when: String, from: String, to: String, sub: String, mine: Boolean): [TimeData!]!
    spendingGrowth(when: String, from: String, to: String, sub: String, mine: Boolean): [TimeData!]!
    spenderGrowth(when: String, from: String, to: String, sub: String, mine: Boolean): [TimeData!]!
    stackingGrowth(when: String, from: String, to: String, sub: String, mine: Boolean): [TimeData!]!
    stackerGrowth(when: String, from: String, to: String, sub: String, mine: Boolean): [TimeData!]!
  }

  type TimeData {
    time: Date!
    data: [NameValue!]!
  }
`
