import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    me: User
    settings: User
    user(name: String!): User
    users: [User!]
    nameAvailable(name: String!): Boolean!
    topUsers(cursor: String, within: String!, userType: String!): TopUsers
  }

  type Users {
    cursor: String
    users: [User!]!
  }

  type TopUsers {
    cursor: String
    users: [TopUser!]!
  }

  type TopUser {
    name: String!
    createdAt: String!
    amount: Int!
  }

  extend type Mutation {
    setName(name: String!): Boolean
    setSettings(tipDefault: Int!, noteItemSats: Boolean!, noteEarning: Boolean!,
      noteAllDescendants: Boolean!, noteMentions: Boolean!, noteDeposits: Boolean!,
      noteInvites: Boolean!, noteJobIndicator: Boolean!, hideInvoiceDesc: Boolean!): Boolean
    setPhoto(photoId: ID!): Int!
    upsertBio(bio: String!): User!
    setWalkthrough(tipPopover: Boolean, upvotePopover: Boolean): Boolean
    unlinkAuth(authType: String!): AuthMethods!
    linkUnverifiedEmail(email: String!): Boolean
  }

  type AuthMethods {
    lightning: Boolean!
    email: String
    twitter: Boolean!
    github: Boolean!
  }

  type User {
    id: ID!
    createdAt: String!
    name: String
    nitems: Int!
    ncomments: Int!
    stacked: Int!
    freePosts: Int!
    freeComments: Int!
    hasNewNotes: Boolean!
    hasInvites: Boolean!
    tipDefault: Int!
    bio: Item
    bioId: Int
    photoId: Int
    sats: Int!
    upvotePopover: Boolean!
    tipPopover: Boolean!
    noteItemSats: Boolean!
    noteEarning: Boolean!
    noteAllDescendants: Boolean!
    noteMentions: Boolean!
    noteDeposits: Boolean!
    noteInvites: Boolean!
    noteJobIndicator: Boolean!
    hideInvoiceDesc: Boolean!
    lastCheckedJobs: String
    authMethods: AuthMethods!
  }
`
