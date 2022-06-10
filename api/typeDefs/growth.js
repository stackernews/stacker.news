import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    registrationGrowth: [TimeNum!]!
    activeGrowth: [TimeNum!]!
    itemGrowth: [TimeNum!]!
    spentGrowth: [TimeNum!]!
  }

  type TimeNum {
    time: String!
    num: Int!
  }
`
