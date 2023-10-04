import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    me(skipUpdate: Boolean): User
    settings: User
    user(name: String!): User
    users: [User!]
    nameAvailable(name: String!): Boolean!
    topUsers(cursor: String, when: String, by: String): Users
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
    setSettings(tipDefault: Int!, turboTipping: Boolean!, fiatCurrency: String!, noteItemSats: Boolean!,
      noteEarning: Boolean!, noteAllDescendants: Boolean!, noteMentions: Boolean!, noteDeposits: Boolean!,
      noteInvites: Boolean!, noteJobIndicator: Boolean!, noteCowboyHat: Boolean!, hideInvoiceDesc: Boolean!,
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

  type User {
    id: ID!
    createdAt: Date!
    name: String
    nitems(when: String): Int!
    nposts(when: String): Int!
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
