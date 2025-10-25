import { gql } from '@apollo/client'

// we can't import from users because of circular dependency
const STREAK_FIELDS = gql`
  fragment StreakFields on User {
    optional {
      streak
      hasSendWallet
      hasRecvWallet
    }
  }
`

export const COMMENT_FIELDS = gql`
  ${STREAK_FIELDS}
  fragment CommentFields on Item {
    id
    position
    parentId
    createdAt
    invoicePaidAt
    deletedAt
    text
    lexicalState
    html
    user {
      id
      name
      meMute
      ...StreakFields
    }
    sats
    credits
    meAnonSats @client
    upvotes
    freedFreebie
    boost
    meSats
    meCredits
    meDontLikeSats
    meBookmark
    meSubscription
    outlawed
    freebie
    path
    commentSats
    commentCredits
    mine
    otsHash
    ncomments
    nDirectComments
    live @client
    imgproxyUrls
    rel
    apiKey
    invoice {
      id
      actionState
      confirmedAt
      hmac
    }
    cost
  }
`

export const COMMENT_FIELDS_NO_CHILD_COMMENTS = gql`
  ${STREAK_FIELDS}
  fragment CommentFieldsNoChildComments on Item {
    id
    position
    parentId
    createdAt
    invoicePaidAt
    deletedAt
    text
    lexicalState
    html
    user {
      id
      name
      meMute
      ...StreakFields
    }
    sats
    credits
    meAnonSats @client
    upvotes
    freedFreebie
    boost
    meSats
    meCredits
    meDontLikeSats
    meBookmark
    meSubscription
    outlawed
    freebie
    path
    commentSats
    commentCredits
    mine
    otsHash
    live @client
    imgproxyUrls
    rel
    apiKey
    invoice {
      id
      actionState
      confirmedAt
      hmac
    }
    cost
  }
`

export const COMMENTS_ITEM_EXT_FIELDS = gql`
  ${STREAK_FIELDS}
  fragment CommentItemExtFields on Item {
    text
    lexicalState
    html
    root {
      id
      title
      bounty
      ncomments
      bountyPaidTo
      subName
      sub {
        name
        userId
        moderated
        meMuteSub
      }
      user {
        name
        id
        ...StreakFields
      }
    }
  }`

// we only get the first COMMENT_DEPTH_LIMIT comments
export const COMMENTS = gql`
  ${COMMENT_FIELDS}

  fragment CommentsRecursive on Item {
    ...CommentFields
    comments {
      comments {
        ...CommentFields
        comments {
          comments {
            ...CommentFields
            comments {
              comments {
                ...CommentFields
                comments {
                  comments {
                    ...CommentFields
                    comments {
                      comments {
                        ...CommentFields
                        comments {
                          comments {
                            ...CommentFields
                            comments {
                              comments {
                                ...CommentFields
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }`

export const HAS_COMMENTS = gql`
  fragment HasComments on Item {
    comments
  }
`

export const GET_NEW_COMMENTS = gql`
  ${COMMENT_FIELDS_NO_CHILD_COMMENTS}

  query GetNewComments($itemId: ID, $after: Date) {
    newComments(itemId: $itemId, after: $after) {
      comments {
        ...CommentFieldsNoChildComments
      }
    }
  }
`
