import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    me: User
    user(id: ID!): User
    users: [User!]
  }

  type User {
    id: ID!
    name: String
    messages: [Message!]
  }
`
