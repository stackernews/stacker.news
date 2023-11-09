import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    me: User
    settings: User
    user(name: String!): User
    users: [User!]
    nameAvailable(name: String!): Boolean!
    topUsers(cursor: String, when: String, from: String, to: String, by: String, limit: Int): Users
    topCowboys(cursor: String): Users
    searchUsers(q: String!, limit: Int, similarity: Float): [User!]!
    hasNewNotes: Boolean!
  }

  type Users {
    cursor: String
    users: [User!]!
  }

  extend type Mutation {
    setName(name: String!): String
    setSettings(tipDefault: Int!, turboTipping: Boolean!, fiatCurrency: String!, withdrawMaxFeeDefault: Int!, noteItemSats: Boolean!,
      noteEarning: Boolean!, noteAllDescendants: Boolean!, noteMentions: Boolean!, noteDeposits: Boolean!,
      noteInvites: Boolean!, noteJobIndicator: Boolean!, noteCowboyHat: Boolean!, hideInvoiceDesc: Boolean!, autoDropWdInvoices: Boolean!,
      hideFromTopUsers: Boolean!, hideCowboyHat: Boolean!, imgproxyOnly: Boolean!,
      wildWestMode: Boolean!, greeterMode: Boolean!, nostrPubkey: String, nostrCrossposting: Boolean, nostrRelays: [String!], hideBookmarks: Boolean!,
      noteForwardedSats: Boolean!, hideWalletBalance: Boolean!, hideIsContributor: Boolean!, diagnostics: Boolean!): User
    setPhoto(photoId: ID!): Int!
    upsertBio(bio: String!): User!
    setWalkthrough(tipPopover: Boolean, upvotePopover: Boolean): Boolean
    unlinkAuth(authType: String!): AuthMethods!
    linkUnverifiedEmail(email: String!): Boolean
    hideWelcomeBanner: Boolean
    subscribeUserPosts(id: ID): User
    subscribeUserComments(id: ID): User
    toggleMute(id: ID): User
  }

  type AuthMethods {
    lightning: Boolean!
    nostr: Boolean!
    github: Boolean!
    twitter: Boolean!
    email: String
  }

  type Image {
    id: ID!
    createdAt: Date!
    updatedAt: Date!
    type: String!
    size: Int!
    width: Int
    height: Int
    itemId: Int
    userId: Int!
  }

  type User {
    id: ID!
    createdAt: Date!
    name: String
    nitems(when: String, from: String, to: String): Int!
    nposts(when: String, from: String, to: String): Int!
    ncomments(when: String, from: String, to: String): Int!
    nbookmarks(when: String, from: String, to: String): Int!
    stacked(when: String, from: String, to: String): Int!
    spent(when: String, from: String, to: String): Int!
    referrals(when: String, from: String, to: String): Int!
    freePosts: Int!
    freeComments: Int!
    hasInvites: Boolean!
    tipDefault: Int!
    turboTipping: Boolean!
    fiatCurrency: String!
    withdrawMaxFeeDefault: Int!
    nostrPubkey: String
    nostrRelays: [String!]
    bio: Item
    bioId: Int
    photoId: Int
    streak: Int
    maxStreak: Int
    sats: Int!
    since: Int
    upvotePopover: Boolean!
    tipPopover: Boolean!
    nostrCrossposting: Boolean!
    noteItemSats: Boolean!
    noteEarning: Boolean!
    noteAllDescendants: Boolean!
    noteMentions: Boolean!
    noteDeposits: Boolean!
    noteInvites: Boolean!
    noteJobIndicator: Boolean!
    noteCowboyHat: Boolean!
    noteForwardedSats: Boolean!
    hideInvoiceDesc: Boolean!
    autoDropWdInvoices: Boolean!
    hideFromTopUsers: Boolean!
    hideCowboyHat: Boolean!
    hideBookmarks: Boolean!
    hideWelcomeBanner: Boolean!
    hideWalletBalance: Boolean!
    diagnostics: Boolean!
    imgproxyOnly: Boolean!
    wildWestMode: Boolean!
    greeterMode: Boolean!
    lastCheckedJobs: String
    authMethods: AuthMethods!
    isContributor: Boolean!
    hideIsContributor: Boolean!
    meSubscriptionPosts: Boolean!
    meSubscriptionComments: Boolean!
    meMute: Boolean
  }
`
