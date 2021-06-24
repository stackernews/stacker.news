import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    me: User
    user(name: String!): User
    users: [User!]
    nameAvailable(name: String!): Boolean!
    recentlyStacked: Int!
  }

  extend type Mutation {
    setName(name: String!): Boolean
  }

  type User {
    id: ID!
    name: String
    nitems: Int!
    ncomments: Int!
    stacked: Int!
    freePosts: Int!
    freeComments: Int!
    hasNewNotes: Boolean!
    sats: Int!
    msats: Int!
  }
`
