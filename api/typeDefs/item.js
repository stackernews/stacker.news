import { gql } from 'graphql-tag'
import { LIMIT } from '@/lib/cursor'

export default gql`
  extend type Query {
    items(sub: String, sort: String, type: String, cursor: String, name: String, when: String, from: String, to: String, by: String, limit: Limit! = ${LIMIT}): Items
    item(id: ID!): Item
    pageTitleAndUnshorted(url: String!): TitleUnshorted
    dupes(url: String!): [Item!]
    related(cursor: String, title: String, id: ID, minMatch: String, limit: Limit! = ${LIMIT}): Items
    search(q: String, sub: String, cursor: String, what: String, sort: String, when: String, from: String, to: String): Items
    itemRepetition(parentId: ID): Int!
    newComments(itemId: ID, after: Date): Comments!
  }

  type TitleUnshorted {
    title: String
    unshorted: String
  }

  extend type Mutation {
    bookmarkItem(id: ID): Item
    pinItem(id: ID): Item
    subscribeItem(id: ID): Item
    deleteItem(id: ID): Item
    upsertLink(
      id: ID, subNames: [String!], title: String!, url: String!, text: String, boost: Int, forward: [ItemForwardInput],
      hash: String, hmac: String): PayIn!
    upsertDiscussion(
      id: ID, subNames: [String!], title: String!, text: String, boost: Int, forward: [ItemForwardInput],
      hash: String, hmac: String): PayIn!
    upsertBounty(
      id: ID, subNames: [String!], title: String!, text: String, bounty: Int, boost: Int, forward: [ItemForwardInput],
      hash: String, hmac: String): PayIn!
    upsertJob(
      id: ID, subNames: [String!], title: String!, company: String!, location: String, remote: Boolean,
      text: String!, url: String!, boost: Int, status: String, logo: Int): PayIn!
    upsertPoll(
      id: ID, subNames: [String!], title: String!, text: String, options: [String!]!, boost: Int, forward: [ItemForwardInput], pollExpiresAt: Date,
      randPollOptions: Boolean, hash: String, hmac: String): PayIn!
    updateNoteId(id: ID!, noteId: String!): Item!
    upsertComment(id: ID, text: String!, parentId: ID, boost: Int, hash: String, hmac: String): PayIn!
    act(id: ID!, sats: Int, act: String, hasSendWallet: Boolean): PayIn!
    pollVote(id: ID!): PayIn!
    updateCommentsViewAt(id: ID!, meCommentsViewedAt: Date!): Date
  }

  type PollOption {
    id: ID,
    option: String!
    count: Int!
  }

  type Poll {
    count: Int!
    options: [PollOption!]!
    randPollOptions: Boolean
    meVoted: Boolean!
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

  type ItemAct {
    id: ID!
    sats: Int!
    act: String!
    path: String
    payIn: PayIn
  }

  type PollVote {
    id: ID!
    payIn: PayIn
  }

  type Item {
    id: ID!
    createdAt: Date!
    updatedAt: Date!
    deletedAt: Date
    deleteScheduledAt: Date
    reminderScheduledAt: Date
    title: String
    searchTitle: String
    url: String
    searchText: String
    text: String
    lexicalState: String
    html: String
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
    downSats: Int!
    credits: Int!
    commentSats: Int!
    commentCredits: Int!
    commentDownSats: Int!
    lastCommentAt: Date
    upvotes: Int!
    meSats: Int!
    meCredits: Int!
    meDontLikeSats: Int!
    meBookmark: Boolean!
    meSubscription: Boolean!
    meForward: Boolean
    freebie: Boolean!
    netInvestment: Int!
    freedFreebie: Boolean!
    bio: Boolean!
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
    subs: [Sub!]
    subNames: [String!]
    status: String!
    uploadId: Int
    otsHash: String
    parentOtsHash: String
    forwards: [ItemForward]
    imgproxyUrls: JSONObject
    rel: String
    apiKey: Boolean
    cost: Int!
    payIn: PayIn
    meCommentsViewedAt: Date
  }

  input ItemForwardInput {
    nym: String!
    pct: Int!
  }
`
