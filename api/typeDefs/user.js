import { gql } from 'apollo-server-micro'

export default gql`
  extend type Query {
    me: User
    settings: User
    user(name: String!): User
    users: [User!]
    nameAvailable(name: String!): Boolean!
    topUsers(cursor: String, when: String, sort: String): Users
    topCowboys(cursor: String): Users
    searchUsers(q: String!, limit: Int, similarity: Float): [User!]!
    hasNewNotes: Boolean!
  }

  type Users {
    cursor: String
    users: [User!]!
  }

  extend type Mutation {
    setName(name: String!): Boolean
    setSettings(tipDefault: Int!, turboTipping: Boolean!, fiatCurrency: String!, noteItemSats: Boolean!,
      noteEarning: Boolean!, noteAllDescendants: Boolean!, noteMentions: Boolean!, noteDeposits: Boolean!,
      noteInvites: Boolean!, noteJobIndicator: Boolean!, noteCowboyHat: Boolean!, hideInvoiceDesc: Boolean!,
      hideFromTopUsers: Boolean!, hideCowboyHat: Boolean!,
      wildWestMode: Boolean!, greeterMode: Boolean!, nostrPubkey: String, nostrRelays: [String!]): User
    setPhoto(photoId: ID!): Int!
    upsertBio(bio: String!): User!
    setWalkthrough(tipPopover: Boolean, upvotePopover: Boolean): Boolean
    unlinkAuth(authType: String!): AuthMethods!
    linkUnverifiedEmail(email: String!): Boolean
  }

  type AuthMethods {
    lightning: Boolean!
    slashtags: Boolean!
    github: Boolean!
    twitter: Boolean!
    email: String
  }

  type User {
    id: ID!
    createdAt: String!
    name: String
    nitems(when: String): Int!
    ncomments(when: String): Int!
    nbookmarks(when: String): Int!
    stacked(when: String): Int!
    spent(when: String): Int!
    referrals(when: String): Int!
    freePosts: Int!
    freeComments: Int!
    hasInvites: Boolean!
    tipDefault: Int!
    turboTipping: Boolean!
    fiatCurrency: String!
    nostrPubkey: String
    nostrRelays: [String!]
    bio: Item
    bioId: Int
    photoId: Int
    streak: Int
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
    noteCowboyHat: Boolean!
    hideInvoiceDesc: Boolean!
    hideFromTopUsers: Boolean!
    hideCowboyHat: Boolean!
    wildWestMode: Boolean!
    greeterMode: Boolean!
    lastCheckedJobs: String
    authMethods: AuthMethods!
  }
`
