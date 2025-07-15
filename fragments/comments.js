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
    newComments @client
    injected @client
    imgproxyUrls
    rel
    apiKey
    invoice {
      id
      actionState
      confirmedAt
    }
    cost
  }
`

export const COMMENTS_ITEM_EXT_FIELDS = gql`
  ${STREAK_FIELDS}
  fragment CommentItemExtFields on Item {
    text
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

export const COMMENT_WITH_NEW_RECURSIVE = gql`
  ${COMMENT_FIELDS}
  ${COMMENTS}
  
  fragment CommentWithNewRecursive on Item {
    ...CommentFields
    comments {
      comments {
        ...CommentsRecursive
      }
    }
    newComments @client
    injected @client
  }
`

export const COMMENT_WITH_NEW_LIMITED = gql`
  ${COMMENT_FIELDS}
  
  fragment CommentWithNewLimited on Item {
    ...CommentFields
    comments {
      comments {
        ...CommentFields
      }
    }
    newComments @client
    injected @client
  }
`

// TODO: fragment for comments without item.comments field
// TODO: remove if useless to pursue
export const COMMENT_WITH_NEW = gql`
  ${COMMENT_FIELDS}
  
  fragment CommentWithNew on Item {
    ...CommentFields
    newComments @client
  }
`

export const GET_NEW_COMMENTS = gql`
  ${COMMENTS}
  
  query GetNewComments($rootId: ID, $after: Date) {
    newComments(rootId: $rootId, after: $after) {
      comments {
        ...CommentsRecursive
      }
    }
  }
`
