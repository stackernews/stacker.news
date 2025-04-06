import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    items(sub: String, sort: String, type: String, cursor: String, name: String, when: String, from: String, to: String, by: String, limit: Limit): Items
    item(id: ID!): Item
    pageTitleAndUnshorted(url: String!): TitleUnshorted
    dupes(url: String!): [Item!]
    related(cursor: String, title: String, id: ID, minMatch: String, limit: Limit): Items
    search(q: String, sub: String, cursor: String, what: String, sort: String, when: String, from: String, to: String): Items
    auctionPosition(sub: String, id: ID, boost: Int): Int!
    boostPosition(sub: String, id: ID, boost: Int): BoostPositions!
    itemRepetition(parentId: ID): Int!
  }

  type BoostPositions {
    home: Boolean!
    sub: Boolean!
    homeMaxBoost: Int!
    subMaxBoost: Int!
  }

  type TitleUnshorted {
    title: String
    unshorted: String
  }

  type ItemActResult {
    id: ID!
    sats: Int!
    path: String
    act: String!
  }

  type ItemAct {
    id: ID!
    act: String!
    invoice: Invoice
  }

  extend type Mutation {
    bookmarkItem(id: ID): Item
    pinItem(id: ID): Item
    subscribeItem(id: ID): Item
    deleteItem(id: ID): Item
    upsertLink(
      id: ID, sub: String, title: String!, url: String!, text: String, boost: Int, forward: [ItemForwardInput],
      hash: String, hmac: String): ItemPaidAction!
    upsertDiscussion(
      id: ID, sub: String, title: String!, text: String, boost: Int, forward: [ItemForwardInput],
      hash: String, hmac: String): ItemPaidAction!
    upsertBounty(
      id: ID, sub: String, title: String!, text: String, bounty: Int, boost: Int, forward: [ItemForwardInput],
      hash: String, hmac: String): ItemPaidAction!
    upsertJob(
      id: ID, sub: String!, title: String!, company: String!, location: String, remote: Boolean,
      text: String!, url: String!, boost: Int, status: String, logo: Int): ItemPaidAction!
    upsertPoll(
      id: ID, sub: String, title: String!, text: String, options: [String!]!, boost: Int, forward: [ItemForwardInput], pollExpiresAt: Date,
      hash: String, hmac: String): ItemPaidAction!
    updateNoteId(id: ID!, noteId: String!): Item!
    upsertComment(id: ID, text: String!, parentId: ID, boost: Int, hash: String, hmac: String): ItemPaidAction!
    act(id: ID!, sats: Int, act: String, hasSendWallet: Boolean): ItemActPaidAction!
    pollVote(id: ID!): PollVotePaidAction!
    toggleOutlaw(id: ID!): Item!
  }

  type PollVoteResult {
    id: ID!
  }

  type PollOption {
    id: ID,
    option: String!
    count: Int!
  }

  type Poll {
    meVoted: Boolean!
    meInvoiceId: Int
    meInvoiceActionState: InvoiceActionState
    count: Int!
    options: [PollOption!]!
  }

  type Items {
    cursor: String
    items: [Item!]!
    pins: [Item!]
    ad: Item
  }

  type Comments {
    cursor: String
    comments: [Item!]!
  }

  enum InvoiceActionState {
    PENDING
    PENDING_HELD
    HELD
    PAID
    FAILED
  }

  type Item {
    id: ID!
    createdAt: Date!
    updatedAt: Date!
    invoicePaidAt: Date
    deletedAt: Date
    deleteScheduledAt: Date
    reminderScheduledAt: Date
    title: String
    searchTitle: String
    url: String
    searchText: String
    text: String
    parentId: Int
    parent: Item
    root: Item
    user: User!
    userId: Int!
    depth: Int
    mine: Boolean!
    boost: Int!
    bounty: Int
    bountyPaidTo: [Int]
    noteId: String
    sats: Int!
    credits: Int!
    commentSats: Int!
    commentCredits: Int!
    lastCommentAt: Date
    upvotes: Int!
    meSats: Int!
    meCredits: Int!
    meDontLikeSats: Int!
    meBookmark: Boolean!
    meSubscription: Boolean!
    meForward: Boolean
    outlawed: Boolean!
    freebie: Boolean!
    freedFreebie: Boolean!
    bio: Boolean!
    paidImgLink: Boolean
    ncomments: Int!
    nDirectComments: Int!
    comments(sort: String, cursor: String): Comments!
    path: String
    position: Int
    prior: Int
    isJob: Boolean!
    pollCost: Int
    poll: Poll
    pollExpiresAt: Date
    company: String
    location: String
    remote: Boolean
    sub: Sub
    subName: String
    status: String!
    uploadId: Int
    otsHash: String
    parentOtsHash: String
    forwards: [ItemForward]
    imgproxyUrls: JSONObject
    rel: String
    apiKey: Boolean
    invoice: Invoice
    cost: Int!
  }

  input ItemForwardInput {
    nym: String!
    pct: Int!
  }
`
