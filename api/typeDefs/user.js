import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    me: User
    settings: User
    user(name: String!): User
    users: [User!]
    nameAvailable(name: String!): Boolean!
    topUsers(cursor: String, when: String, from: String, to: String, by: String, limit: Limit): Users
    topCowboys(cursor: String): Users
    searchUsers(q: String!, limit: Limit, similarity: Float): [User!]!
    userSuggestions(q: String, limit: Limit): [User!]!
    hasNewNotes: Boolean!
  }

  type Users {
    cursor: String
    users: [User!]!
  }

  extend type Mutation {
    setName(name: String!): String
    setSettings(settings: SettingsInput!): User
    setPhoto(photoId: ID!): Int!
    upsertBio(bio: String!): User!
    setWalkthrough(tipPopover: Boolean, upvotePopover: Boolean): Boolean
    unlinkAuth(authType: String!): AuthMethods!
    linkUnverifiedEmail(email: String!): Boolean
    hideWelcomeBanner: Boolean
    subscribeUserPosts(id: ID): User
    subscribeUserComments(id: ID): User
    toggleMute(id: ID): User
    setAutoWithdraw(lnAddr: String!, autoWithdrawThreshold: Int!, autoWithdrawMaxFeePercent: Float!): Boolean
    removeAutoWithdraw: Boolean
  }

  type User {
    id: ID!
    createdAt: Date!
    name: String
    nitems(when: String, from: String, to: String): Int!
    nposts(when: String, from: String, to: String): Int!
    ncomments(when: String, from: String, to: String): Int!
    bio: Item
    bioId: Int
    photoId: Int
    since: Int

    optional: UserOptional!
    privates: UserPrivates

    meMute: Boolean!
    meSubscriptionPosts: Boolean!
    meSubscriptionComments: Boolean!
  }

  input SettingsInput {
    autoDropBolt11s: Boolean!
    diagnostics: Boolean!
    fiatCurrency: String!
    greeterMode: Boolean!
    hideBookmarks: Boolean!
    hideCowboyHat: Boolean!
    hideFromTopUsers: Boolean!
    hideInvoiceDesc: Boolean!
    hideIsContributor: Boolean!
    hideWalletBalance: Boolean!
    imgproxyOnly: Boolean!
    nostrCrossposting: Boolean!
    nostrPubkey: String
    nostrRelays: [String!]
    noteAllDescendants: Boolean!
    noteTerritoryPosts: Boolean!
    noteCowboyHat: Boolean!
    noteDeposits: Boolean!
    noteEarning: Boolean!
    noteForwardedSats: Boolean!
    noteInvites: Boolean!
    noteItemSats: Boolean!
    noteJobIndicator: Boolean!
    noteMentions: Boolean!
    tipDefault: Int!
    turboTipping: Boolean!
    wildWestMode: Boolean!
    withdrawMaxFeeDefault: Int!
  }

  type AuthMethods {
    lightning: Boolean!
    nostr: Boolean!
    github: Boolean!
    twitter: Boolean!
    email: String
  }

  type UserPrivates {
    """
    extremely sensitive
    """
    sats: Int!
    authMethods: AuthMethods!
    lnAddr: String

    """
    only relevant to user
    """
    lastCheckedJobs: String
    hideWelcomeBanner: Boolean!
    tipPopover: Boolean!
    upvotePopover: Boolean!
    hasInvites: Boolean!

    """
    mirrors SettingsInput
    """
    autoDropBolt11s: Boolean!
    diagnostics: Boolean!
    fiatCurrency: String!
    greeterMode: Boolean!
    hideBookmarks: Boolean!
    hideCowboyHat: Boolean!
    hideFromTopUsers: Boolean!
    hideInvoiceDesc: Boolean!
    hideIsContributor: Boolean!
    hideWalletBalance: Boolean!
    imgproxyOnly: Boolean!
    nostrCrossposting: Boolean!
    nostrPubkey: String
    nostrRelays: [String!]
    noteAllDescendants: Boolean!
    noteTerritoryPosts: Boolean!
    noteCowboyHat: Boolean!
    noteDeposits: Boolean!
    noteEarning: Boolean!
    noteForwardedSats: Boolean!
    noteInvites: Boolean!
    noteItemSats: Boolean!
    noteJobIndicator: Boolean!
    noteMentions: Boolean!
    tipDefault: Int!
    turboTipping: Boolean!
    wildWestMode: Boolean!
    withdrawMaxFeeDefault: Int!
    autoWithdrawThreshold: Int
    autoWithdrawMaxFeePercent: Float
  }

  type UserOptional {
    """
    conditionally private
    """
    stacked(when: String, from: String, to: String): Int
    spent(when: String, from: String, to: String): Int
    referrals(when: String, from: String, to: String): Int
    streak: Int
    maxStreak: Int
    isContributor: Boolean
  }
`
