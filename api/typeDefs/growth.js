import { gql } from 'graphql-tag'

export default gql`
  type NameValue {
    name: String!
    value: Float!
  }

  extend type Query {
    registrationGrowth(when: String): [TimeData!]!
    itemGrowth(when: String): [TimeData!]!
    spendingGrowth(when: String): [TimeData!]!
    spenderGrowth(when: String): [TimeData!]!
    stackingGrowth(when: String): [TimeData!]!
    stackerGrowth(when: String): [TimeData!]!
  }

  type TimeData {
    time: Date!
    data: [NameValue!]!
  }
`
