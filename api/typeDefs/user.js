import { gql } from 'graphql-tag'
import { LIMIT } from '@/lib/cursor'

export default gql`
  extend type Query {
    me: User
    settings: User
    user(id: ID, name: String): User
    users: [User!]
    nameAvailable(name: String!): Boolean!
    topUsers(cursor: String, when: String, from: String, to: String, by: String, limit: Limit! = ${LIMIT}): UsersNullable!
    topCowboys(cursor: String): UsersNullable!
    searchUsers(q: String!, limit: Limit! = 5, similarity: Float): [User!]!
    userSuggestions(q: String, limit: Limit! = 5): [User!]!
    hasNewNotes: Boolean!
    mySubscribedUsers(cursor: String): Users!
    myMutedUsers(cursor: String): Users!
    userStatsActions(when: String, from: String, to: String): [TimeData!]!
    userStatsIncomingSats(when: String, from: String, to: String): [TimeData!]!
    userStatsOutgoingSats(when: String, from: String, to: String): [TimeData!]!
  }

  type UsersNullable {
    cursor: String
    users: [User]!
  }

  type Users {
    cursor: String
    users: [User!]!
  }

  input CropData {
    x: Float!
    y: Float!
    width: Float!
    height: Float!
    originalWidth: Int!
    originalHeight: Int!
    scale: Float!
  }

  extend type Mutation {
    setName(name: String!): String
    setSettings(settings: SettingsInput!): User
    cropPhoto(photoId: ID!, cropData: CropData): String!
    setPhoto(photoId: ID!): Int!
    upsertBio(text: String!, lexicalState: String!): ItemPaidAction!
    setWalkthrough(tipPopover: Boolean, upvotePopover: Boolean): Boolean
    unlinkAuth(authType: String!): AuthMethods!
    linkUnverifiedEmail(email: String!): Boolean
    hideWelcomeBanner: Boolean
    hideWalletRecvPrompt: Boolean
    subscribeUserPosts(id: ID): User
    subscribeUserComments(id: ID): User
    toggleMute(id: ID): User
    generateApiKey(id: ID!): String
    deleteApiKey(id: ID!): User
    disableFreebies: Boolean
    setDiagnostics(diagnostics: Boolean!): Boolean
  }

  type User {
    id: ID!
    createdAt: Date!
    name: String!
    nitems(when: String, from: String, to: String): Int!
    nposts(when: String, from: String, to: String): Int!
    nterritories(when: String, from: String, to: String): Int!
    ncomments(when: String, from: String, to: String): Int!
    bio: Item
    bioId: Int
    photoId: Int
    since: Int

    """
    this is only returned when we sort stackers by value
    """
    proportion: Float

    optional: UserOptional!
    privates: UserPrivates

    meMute: Boolean!
    meSubscriptionPosts: Boolean!
    meSubscriptionComments: Boolean!
  }

  input SettingsInput {
    autoDropBolt11s: Boolean!
    noReferralLinks: Boolean!
    fiatCurrency: String!
    satsFilter: Int!
    disableFreebies: Boolean
    hideBookmarks: Boolean!
    hideCowboyHat: Boolean!
    hideGithub: Boolean!
    hideNostr: Boolean!
    hideTwitter: Boolean!
    hideFromTopUsers: Boolean!
    hideInvoiceDesc: Boolean!
    hideIsContributor: Boolean!
    hideWalletBalance: Boolean!
    imgproxyOnly: Boolean!
    showImagesAndVideos: Boolean!
    nostrCrossposting: Boolean!
    nostrPubkey: String
    nostrRelays: [String!]
    noteAllDescendants: Boolean!
    noteCowboyHat: Boolean!
    noteDeposits: Boolean!,
    noteWithdrawals: Boolean!,
    noteEarning: Boolean!
    noteForwardedSats: Boolean!
    noteInvites: Boolean!
    noteItemSats: Boolean!
    noteJobIndicator: Boolean!
    noteMentions: Boolean!
    noteItemMentions: Boolean!
    nsfwMode: Boolean!
    tipDefault: Int!
    tipRandomMin: Int
    tipRandomMax: Int
    turboTipping: Boolean!
    zapUndos: Int
    wildWestMode: Boolean!
    withdrawMaxFeeDefault: Int!
  }

  type AuthMethods {
    lightning: Boolean!
    nostr: Boolean!
    github: Boolean!
    twitter: Boolean!
    email: Boolean!
    apiKey: Boolean
  }

  type UserPrivates {
    """
    extremely sensitive
    """
    sats: Int!
    credits: Int!
    authMethods: AuthMethods!
    lnAddr: String

    """
    only relevant to user
    """
    lastCheckedJobs: String
    hideWelcomeBanner: Boolean!
    hideWalletRecvPrompt: Boolean!
    tipPopover: Boolean!
    upvotePopover: Boolean!
    hasInvites: Boolean!
    apiKeyEnabled: Boolean!
    showPassphrase: Boolean!
    diagnostics: Boolean!

    """
    mirrors SettingsInput
    """
    autoDropBolt11s: Boolean!
    noReferralLinks: Boolean!
    fiatCurrency: String!
    satsFilter: Int!
    disableFreebies: Boolean
    greeterMode: Boolean!
    hideBookmarks: Boolean!
    hideCowboyHat: Boolean!
    hideGithub: Boolean!
    hideNostr: Boolean!
    hideTwitter: Boolean!
    hideFromTopUsers: Boolean!
    hideInvoiceDesc: Boolean!
    hideIsContributor: Boolean!
    hideWalletBalance: Boolean!
    imgproxyOnly: Boolean!
    showImagesAndVideos: Boolean!
    nostrCrossposting: Boolean!
    nostrPubkey: String
    nostrRelays: [String!]
    noteAllDescendants: Boolean!
    noteCowboyHat: Boolean!
    noteDeposits: Boolean!
    noteWithdrawals: Boolean!
    noteEarning: Boolean!
    noteForwardedSats: Boolean!
    noteInvites: Boolean!
    noteItemSats: Boolean!
    noteJobIndicator: Boolean!
    noteMentions: Boolean!
    noteItemMentions: Boolean!
    nsfwMode: Boolean!
    tipDefault: Int!
    tipRandom: Boolean!
    tipRandomMin: Int
    tipRandomMax: Int
    turboTipping: Boolean!
    zapUndos: Int
    wildWestMode: Boolean!
    withdrawMaxFeeDefault: Int!
    autoWithdrawThreshold: Int
    vaultKeyHash: String
    vaultKeyHashUpdatedAt: Date
    walletsUpdatedAt: Date
  }

  type UserOptional {
    """
    conditionally private
    """
    stacked(when: String, from: String, to: String): Int
    spent(when: String, from: String, to: String): Int
    referrals(when: String, from: String, to: String): Int
    streak: Int
    gunStreak: Int
    horseStreak: Int
    infected: Boolean
    hasSendWallet: Boolean
    hasRecvWallet: Boolean
    hideWalletRecvPrompt: Boolean
    maxStreak: Int
    isContributor: Boolean
    githubId: String
    twitterId: String
    nostrAuthPubkey: String
  }

  type NameValue {
    name: String!
    value: Float!
  }

  type TimeData {
    time: Date!
    data: [NameValue!]!
  }
`
