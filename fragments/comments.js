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
    upvotes
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

export const MORE_FLAT_COMMENTS = gql`
  ${COMMENT_FIELDS}

  query MoreFlatComments($sub: String, $sort: String!, $cursor: String, $name: String, $within: String) {
    moreFlatComments(sub: $sub, sort: $sort, cursor: $cursor, name: $name, within: $within) {
      cursor
      comments {
        ...CommentFields
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
