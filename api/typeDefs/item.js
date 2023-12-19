import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    items(sub: String, sort: String, type: String, cursor: String, name: String, when: String, from: String, to: String, by: String, limit: Limit): Items
    item(id: ID!): Item
    pageTitleAndUnshorted(url: String!): TitleUnshorted
    dupes(url: String!): [Item!]
    related(cursor: String, title: String, id: ID, minMatch: String, limit: Limit): Items
    search(q: String, sub: String, cursor: String, what: String, sort: String, when: String, from: String, to: String): Items
    auctionPosition(sub: String, id: ID, bid: Int!): Int!
    itemRepetition(parentId: ID): Int!
  }

  type TitleUnshorted {
    title: String
    unshorted: String
  }

  type ItemActResult {
    vote: Int!
    sats: Int!
  }

  extend type Mutation {
    bookmarkItem(id: ID): Item
    subscribeItem(id: ID): Item
    deleteItem(id: ID): Item
    upsertLink(id: ID, sub: String, title: String!, url: String!, text: String, boost: Int, forward: [ItemForwardInput], hash: String, hmac: String): Item!
    upsertDiscussion(id: ID, sub: String, title: String!, text: String, boost: Int, forward: [ItemForwardInput], hash: String, hmac: String): Item!
    upsertBounty(id: ID, sub: String, title: String!, text: String, bounty: Int, hash: String, hmac: String, boost: Int, forward: [ItemForwardInput]): Item!
    upsertJob(id: ID, sub: String!, title: String!, company: String!, location: String, remote: Boolean,
      text: String!, url: String!, maxBid: Int!, status: String, logo: Int, hash: String, hmac: String): Item!
    upsertPoll(id: ID, sub: String, title: String!, text: String, options: [String!]!, boost: Int, forward: [ItemForwardInput], hash: String, hmac: String): Item!
    updateNoteId(id: ID!, noteId: String!): Item!
    upsertComment(id:ID, text: String!, parentId: ID, hash: String, hmac: String): Item!
    dontLikeThis(id: ID!, sats: Int, hash: String, hmac: String): Boolean!
    act(id: ID!, sats: Int, hash: String, hmac: String): ItemActResult!
    pollVote(id: ID!, hash: String, hmac: String): ID!
  }

  type PollOption {
    id: ID,
    option: String!
    count: Int!
    meVoted: Boolean!
  }

  type Poll {
    meVoted: Boolean!
    count: Int!
    options: [PollOption!]!
  }

  type Items {
    cursor: String
    items: [Item!]!
    pins: [Item!]
  }

  type Comments {
    cursor: String
    comments: [Item!]!
  }

  type Item {
    id: ID!
    createdAt: Date!
    updatedAt: Date!
    deletedAt: Date
    deleteScheduledAt: Date
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
    commentSats: Int!
    lastCommentAt: Date
    upvotes: Int!
    meSats: Int!
    meDontLike: Boolean!
    meBookmark: Boolean!
    meSubscription: Boolean!
    meForward: Boolean
    outlawed: Boolean!
    freebie: Boolean!
    freedFreebie: Boolean!
    bio: Boolean!
    paidImgLink: Boolean
    ncomments: Int!
    comments(sort: String): [Item!]!
    path: String
    position: Int
    prior: Int
    maxBid: Int
    isJob: Boolean!
    pollCost: Int
    poll: Poll
    company: String
    location: String
    remote: Boolean
    sub: Sub
    subName: String
    status: String
    uploadId: Int
    otsHash: String
    parentOtsHash: String
    forwards: [ItemForward]
    imgproxyUrls: JSONObject
  }

  input ItemForwardInput {
    nym: String!
    pct: Int!
  }
`
