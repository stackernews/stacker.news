import { gql } from '@apollo/client'

export const COMMENT_FIELDS = gql`
  fragment CommentFields on Item {
    id
    parentId
    createdAt
    deletedAt
    text
    user {
      name
      streak
      hideCowboyHat
      id
    }
    sats
    meAnonSats @client
    upvotes
    wvotes
    boost
    meSats
    meDontLike
    meBookmark
    meSubscription
    outlawed
    freebie
    path
    commentSats
    mine
    otsHash
    ncomments
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
      user {
        name
        streak
        hideCowboyHat
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
      }
    }
  }`
