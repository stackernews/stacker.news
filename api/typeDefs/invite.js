import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    invites: [Invite!]!
    invite(id: ID!): Invite
  }

  extend type Mutation {
    createInvite(gift: Int!, limit: Int): Invite
    revokeInvite(id: ID!): Invite
  }

  type Invite {
    id: ID!
    createdAt: Date!
    invitees: [User!]!
    gift: Int!
    limit: Int
    user: User!
    revoked: Boolean!
    poor: Boolean!
  }
`
