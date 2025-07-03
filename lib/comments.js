export function updateAncestorsCommentCount (cache, ancestors, increment) {
  // update all ancestors
  ancestors.forEach(id => {
    cache.modify({
      id: `Item:${id}`,
      fields: {
        ncomments (existingNComments = 0) {
          return existingNComments + increment
        }
      },
      optimistic: true
    })
  })
}
