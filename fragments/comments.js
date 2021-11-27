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
    tips
    meVote
    meBoost
    meTip
    mine
    ncomments
    root {
      id
      title
      user {
        name
        id
      }
    }
  }
`

export const MORE_FLAT_COMMENTS = gql`
  ${COMMENT_FIELDS}

  query MoreFlatComments($cursor: String, $name: String!) {
    moreFlatComments(cursor: $cursor, name: $name) {
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
