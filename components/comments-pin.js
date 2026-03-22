export function hoistNestedPins (comments, rootId) {
  const hoisted = []
  const directChildrenCount = (item) => {
    if (typeof item.nDirectComments === 'number') return item.nDirectComments
    return item.comments?.comments?.length ?? 0
  }

  const withCommentsShape = (item) => ({
    ...item,
    comments: item.comments || { comments: [] }
  })

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
          adoptedChildren += directChildrenCount(child)
          hoisted.push({
            ...child,
            nDirectComments: 0,
            comments: {
              ...(child.comments || {}),
              comments: []
            }
          })
          const preservedAdopted = adopted.map(a => ({
            ...withCommentsShape(a),
            nDirectComments: directChildrenCount(a)
          }))
          keptChildren.push(...preservedAdopted)
          continue
        }
        keptChildren.push(child)
      }
      const walkedChildren = walk(keptChildren)
      const nodeComments = node.comments || { comments: [] }
      const adjustedNDirectComments = typeof node.nDirectComments === 'number'
        ? Math.max(0, node.nDirectComments - removedPinnedChildren + adoptedChildren)
        : node.nDirectComments
      const adjustedNComments = typeof node.ncomments === 'number'
        ? Math.max(0, node.ncomments - removedPinnedChildren)
        : node.ncomments
      const fixedWalkedChildren = walkedChildren.map(child => ({
        ...child,
        nDirectComments: directChildrenCount(child)
      }))
      return {
        ...node,
        nDirectComments: adjustedNDirectComments,
        ncomments: adjustedNComments,
        comments: {
          ...nodeComments,
          comments: fixedWalkedChildren
        }
      }
    })
  }
  return { comments: walk(comments || []), hoisted }
}
