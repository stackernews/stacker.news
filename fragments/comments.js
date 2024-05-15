import { gql } from '@apollo/client'

export const COMMENT_FIELDS = gql`
  fragment CommentFields on Item {
    id
    position
    parentId
    createdAt
    deletedAt
    text
    user {
      id
      name
      optional {
        streak
      }
      meMute
    }
    sats
    meAnonSats @client
    upvotes
    freedFreebie
    boost
    meSats
    meDontLikeSats
    meBookmark
    meSubscription
    noteId
    outlawed
    freebie
    path
    commentSats
    mine
    otsHash
    ncomments
    imgproxyUrls
    rel
  }
`

export const COMMENTS_ITEM_EXT_FIELDS = gql`
  fragment CommentItemExtFields on Item {
    text
    root {
      id
      title
      bounty
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
        optional {
          streak
        }
        id
      }
    }
  }`

// we only get the first COMMENT_DEPTH_LIMIT comments
export const COMMENTS = gql`
  ${COMMENT_FIELDS}

  fragment CommentsRecursive on Item {
    ...CommentFields
    comments {
      ...CommentFields
      comments {
        ...CommentFields
        comments {
          ...CommentFields
          comments {
            ...CommentFields
            comments {
              ...CommentFields
              comments {
                ...CommentFields
                comments {
                  ...CommentFields
                }
              }
            }
          }
        }
      }
    }
  }`
