import { gql } from 'apollo-server-micro'

export default gql`
  type NameValue {
    name: String!
    value: Int!
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
    time: String!
    data: [NameValue!]!
  }
`
