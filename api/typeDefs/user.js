import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    me: User
    user(name: String): User
    users: [User!]
  }

  type User {
    id: ID!
    name: String
    nitems: Int!
    ncomments: Int!
    stacked: Int!
    sats: Int!
    msats: Int!
  }
`
