import { gql } from "apollo-server-micro";

export default gql`
  extend type Query {
    items(sub: String, sort: String, type: String, cursor: String, name: String, within: String): Items
    moreFlatComments(sort: String!, cursor: String, name: String, within: String): Comments
    item(id: ID!): Item
    comments(id: ID!, sort: String): [Item!]!
    pageTitle(url: String!): String
    dupes(url: String!): [Item!]
    related(cursor: String, title: String, id: ID, limit: Int): Items
    allItems(cursor: String): Items
    getBountiesByUser(id: Int!): [Item]
    getBountiesByUserName(name: String!): [Item]
    search(q: String, sub: String, cursor: String, what: String, sort: String, when: String): Items
    auctionPosition(sub: String, id: ID, bid: Int!): Int!
    itemRepetition(parentId: ID): Int!
    outlawedItems(cursor: String): Items
    borderlandItems(cursor: String): Items
    freebieItems(cursor: String): Items
    topItems(cursor: String, sort: String, when: String): Items
    topComments(cursor: String, sort: String, when: String): Comments
  }

  type ItemActResult {
    vote: Int!
    sats: Int!
  }

  extend type Mutation {
    upsertLink(
      id: ID
      title: String!
      url: String!
      boost: Int
      forward: String
    ): Item!
    upsertDiscussion(
      id: ID
      title: String!
      text: String
      boost: Int
      forward: String
    ): Item!
    upsertBounty(
      id: ID
      title: String!
      text: String
      bounty: Int!
      boost: Int
      forward: String
    ): Item!
    upsertJob(
      id: ID
      sub: ID!
      title: String!
      company: String!
      location: String
      remote: Boolean
      text: String!
      url: String!
      maxBid: Int!
      status: String
      logo: Int
    ): Item!
    upsertPoll(
      id: ID
      title: String!
      text: String
      options: [String!]!
      boost: Int
      forward: String
    ): Item!
    createComment(text: String!, parentId: ID!): Item!
    updateComment(id: ID!, text: String!): Item!
    dontLikeThis(id: ID!): Boolean!
    act(id: ID!, sats: Int): ItemActResult!
    pollVote(id: ID!): ID!
  }

  type PollOption {
    id: ID
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
    createdAt: String!
    updatedAt: String!
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
    fwdUser: User
    depth: Int!
    mine: Boolean!
    boost: Int!
    bounty: Int
    bountyPaid: Boolean
    bountyPaidTo: Int
    sats: Int!
    commentSats: Int!
    lastCommentAt: String
    upvotes: Int!
    wvotes: Float!
    meSats: Int!
    meDontLike: Boolean!
    outlawed: Boolean!
    freebie: Boolean!
    paidImgLink: Boolean
    ncomments: Int!
    comments: [Item!]!
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
    status: String
    uploadId: Int
  }
`;
