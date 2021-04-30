import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    accounts: [String!]
  }

  extend type Mutation {
    createAccount: String!
  }
`
