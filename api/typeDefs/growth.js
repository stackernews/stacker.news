import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    registrationGrowth: [RegistrationGrowth!]!
    activeGrowth: [TimeNum!]!
    itemGrowth: [ItemGrowth!]!
    spentGrowth: [SpentGrowth!]!
    stackedGrowth: [StackedGrowth!]!
    earnerGrowth: [TimeNum!]!

    registrationsWeekly: Int!
    activeWeekly: Int!
    earnersWeekly: Int!
    itemsWeekly: [NameValue!]!
    spentWeekly: [NameValue!]!
    stackedWeekly: [NameValue!]!
  }

  type TimeNum {
    time: String!
    num: Int!
  }

  type NameValue {
    name: String!
    value: Int!
  }

  type RegistrationGrowth {
    time: String!
    invited: Int!
    organic: Int!
  }

  type ItemGrowth {
    time: String!
    jobs: Int!
    posts: Int!
    comments: Int!
  }

  type StackedGrowth {
    time: String!
    rewards: Int!
    posts: Int!
    comments: Int!
  }

  type SpentGrowth {
    time: String!
    jobs: Int!
    fees: Int!
    boost: Int!
    tips: Int!
  }
`
