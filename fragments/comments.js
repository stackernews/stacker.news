import { gql } from '@apollo/client'

export const COMMENT_FIELDS = gql`
  fragment CommentFields on Item {
    id
    parentId
    createdAt
    text
    user {
      name
    }
    sats
    boost
    meSats
    ncomments
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
