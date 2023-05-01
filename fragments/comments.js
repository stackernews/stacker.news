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
      id
    }
    sats
    upvotes
    boost
    meSats
    meDontLike
    meBookmark
    outlawed
    freebie
    path
    commentSats
    mine
    otsHash
    ncomments
    root {
      id
      title
      bounty
      bountyPaidTo
      user {
        name
        streak
        id
      }
    }
  }
`

export const MORE_FLAT_COMMENTS = gql`
  ${COMMENT_FIELDS}

  query MoreFlatComments($sub: String, $sort: String!, $cursor: String, $name: String, $within: String) {
    moreFlatComments(sub: $sub, sort: $sort, cursor: $cursor, name: $name, within: $within) {
      cursor
      comments {
        ...CommentFields
      }
    }
  }
`

export const TOP_COMMENTS = gql`
  ${COMMENT_FIELDS}

  query topComments($sort: String, $cursor: String, $when: String = "day") {
    topComments(sort: $sort, cursor: $cursor, when: $when) {
      cursor
      comments {
        ...CommentFields
      }
    }
  }
`

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
      }
    }
  }`
