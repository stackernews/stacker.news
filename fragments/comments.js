import { gql } from '@apollo/client'

// we can't import from users because of circular dependency
const STREAK_FIELDS = gql`
  fragment StreakFields on User {
    optional {
    streak
    gunStreak
      horseStreak
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
    imgproxyUrls
    cloneBornAt
    cloneDiedAt
    oldVersions {
      id
      title
      text
      url
      createdAt
      updatedAt
      cloneBornAt
      cloneDiedAt
    }
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
