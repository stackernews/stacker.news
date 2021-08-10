import { gql } from '@apollo/client'

export const COMMENT_FIELDS = gql`
  fragment CommentFields on Item {
    id
    parentId
    createdAt
    text
    user {
      name
      id
    }
    sats
    boost
    meSats
    ncomments
    root {
      id
      title
    }
  }
`

export const MORE_FLAT_COMMENTS = gql`
  ${COMMENT_FIELDS}

  query MoreFlatComments($cursor: String, $userId: ID) {
    moreFlatComments(cursor: $cursor, userId: $userId) {
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
