export function hoistNestedPins (comments, rootId) {
  const hoisted = []
  function walk (nodes) {
    return (nodes || []).map(node => {
      const children = node.comments?.comments || []
      const keptChildren = []
      let removedPinnedChildren = 0
      let adoptedChildren = 0
      for (const child of children) {
        const isPinnedNestedChild = Boolean(child.position) && child.parentId !== rootId
        if (isPinnedNestedChild) {
          removedPinnedChildren += 1
          const adopted = child.comments?.comments || []
          adoptedChildren += typeof child.nDirectComments === 'number' ? child.nDirectComments : adopted.length
          hoisted.push({
            ...child,
            nDirectComments: 0,
            comments: {
              ...(child.comments || {}),
              comments: []
            }
          })
          keptChildren.push(...adopted)
          continue
        }
        keptChildren.push(child)
      }
      const walkedChildren = walk(keptChildren)
      if (!node.comments) return node
      const adjustedNDirectComments = typeof node.nDirectComments === 'number'
        ? Math.max(0, node.nDirectComments - removedPinnedChildren + adoptedChildren)
        : node.nDirectComments
      const adjustedNComments = typeof node.ncomments === 'number'
        ? Math.max(0, node.ncomments - removedPinnedChildren)
        : node.ncomments
      return {
        ...node,
        nDirectComments: adjustedNDirectComments,
        ncomments: adjustedNComments,
        comments: {
          ...node.comments,
          comments: walkedChildren
        }
      }
    })
  }
  return { comments: walk(comments || []), hoisted }
}
