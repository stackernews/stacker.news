import { gql } from 'graphql-tag'

export default gql`
  extend type Query {
    items(sub: String, sort: String, type: String, cursor: String, name: String, when: String, by: String, limit: Int): Items
    item(id: ID!): Item
    pageTitleAndUnshorted(url: String!): TitleUnshorted
    dupes(url: String!): [Item!]
    related(cursor: String, title: String, id: ID, minMatch: String, limit: Int): Items
    search(q: String, sub: String, cursor: String, what: String, sort: String, when: String): Items
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
    upsertLink(id: ID, sub: String, title: String!, url: String!, boost: Int, forward: String, invoiceHash: String, invoiceHmac: String): Item!
    upsertDiscussion(id: ID, sub: String, title: String!, text: String, boost: Int, forward: String, invoiceHash: String, invoiceHmac: String): Item!
    upsertBounty(id: ID, sub: String, title: String!, text: String, bounty: Int!, boost: Int, forward: String): Item!
    upsertJob(id: ID, sub: String!, title: String!, company: String!, location: String, remote: Boolean,
      text: String!, url: String!, maxBid: Int!, status: String, logo: Int): Item!
    upsertPoll(id: ID, sub: String, title: String!, text: String, options: [String!]!, boost: Int, forward: String, invoiceHash: String, invoiceHmac: String): Item!
    createComment(text: String!, parentId: ID!, invoiceHash: String, invoiceHmac: String): Item!
    updateComment(id: ID!, text: String!): Item!
    dontLikeThis(id: ID!): Boolean!
    act(id: ID!, sats: Int, invoiceHash: String, invoiceHmac: String): ItemActResult!
    pollVote(id: ID!): ID!
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
    fwdUserId: Int
    fwdUser: User
    depth: Int!
    mine: Boolean!
    boost: Int!
    bounty: Int
    bountyPaidTo: [Int]
    sats: Int!
    commentSats: Int!
    lastCommentAt: Date
    upvotes: Int!
    wvotes: Float!
    meSats: Int!
    meDontLike: Boolean!
    meBookmark: Boolean!
    meSubscription: Boolean!
    outlawed: Boolean!
    freebie: Boolean!
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
  }
`
